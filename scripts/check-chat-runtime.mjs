import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing env vars for Supabase runtime check.");
  process.exit(1);
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function checkRlsBasics() {
  const selectAsAnon = await anon.from("chat_rooms").select("room_id").limit(1);
  const insertAsAnon = await anon.from("chat_messages").insert({
    room_id: "00000000-0000-0000-0000-000000000000",
    content: "probe",
    message_type: "text",
  });

  const selectLooksRestricted = !selectAsAnon.error;
  const insertBlocked = Boolean(insertAsAnon.error);

  return {
    selectLooksRestricted,
    insertBlocked,
    selectError: selectAsAnon.error?.message ?? null,
    insertError: insertAsAnon.error?.message ?? null,
  };
}

async function checkRealtimeProbe() {
  const { data: room, error: roomError } = await service
    .from("chat_rooms")
    .insert({ room_type: "group", room_name: "realtime_probe", created_by: null })
    .select("room_id")
    .single();

  if (roomError || !room?.room_id) {
    return { ok: false, reason: `failed_create_room: ${roomError?.message ?? "unknown"}` };
  }

  const roomId = String(room.room_id);

  try {
    const gotEvent = await new Promise((resolve) => {
      let settled = false;

      const channel = service
        .channel(`chat-runtime-probe-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
          () => {
            if (!settled) {
              settled = true;
              resolve(true);
            }
          },
        )
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await service.from("chat_messages").insert({
              room_id: roomId,
              sender_id: null,
              message_type: "system",
              content: "realtime probe",
            });
          }
        });

      setTimeout(async () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
        await service.removeChannel(channel);
      }, 7000);
    });

    return {
      ok: Boolean(gotEvent),
      reason: gotEvent ? null : "timeout_waiting_realtime_event",
    };
  } finally {
    await service.from("chat_rooms").delete().eq("room_id", roomId);
  }
}

async function main() {
  const rls = await checkRlsBasics();
  const realtime = await checkRealtimeProbe();

  console.log(JSON.stringify({ rls, realtime }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
