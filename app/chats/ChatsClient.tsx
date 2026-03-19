"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabase/client";

type ChatRoomItem = {
  room_id: string;
  room_type: "direct" | "group" | "lug";
  room_name: string | null;
  member_role: "owner" | "admin" | "member";
  participant_ids: string[];
  last_message_id: string | null;
  last_message_sender_id: string | null;
  last_message_content: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type ChatMessageItem = {
  message_id: string;
  room_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
};

type LugMemberItem = {
  id: string;
  full_name: string;
  avatar_key: string | null;
};

const PAGE_SIZE = 40;

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function normalizeRoomType(value: string): "direct" | "group" | "lug" {
  if (value === "direct" || value === "group" || value === "lug") {
    return value;
  }
  return "group";
}

export default function ChatsClient({ initialRoomId }: { initialRoomId?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId ?? null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [oldestMessageAt, setOldestMessageAt] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [lugMembers, setLugMembers] = useState<LugMemberItem[]>([]);
  const [selectedDirectMemberId, setSelectedDirectMemberId] = useState<string>("");
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<Record<string, boolean>>({});
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [avatarById, setAvatarById] = useState<Record<string, string>>({});

  const getSupabaseAuthHeaders = useCallback(async () => {
    if (!supabase) {
      return undefined;
    }
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return undefined;
    }
    return { Authorization: `Bearer ${accessToken}` };
  }, [supabase]);

  const loadIdentityMaps = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(0, 300);
      if (uniqueIds.length === 0) {
        return;
      }

      const authHeaders = await getSupabaseAuthHeaders();

      const [namesResponse, avatarsResponse] = await Promise.all([
        fetch("/api/profiles/names", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeaders ?? {}),
          },
          body: JSON.stringify({ ids: uniqueIds }),
        }),
        fetch("/api/profiles/avatars", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeaders ?? {}),
          },
          body: JSON.stringify({ ids: uniqueIds }),
        }),
      ]);

      const namesPayload = (await namesResponse.json().catch(() => ({}))) as { names?: Record<string, string> };
      const avatarsPayload = (await avatarsResponse.json().catch(() => ({}))) as { avatars?: Record<string, string> };

      if (namesPayload.names) {
        setNameById((prev) => ({ ...prev, ...namesPayload.names }));
      }
      if (avatarsPayload.avatars) {
        setAvatarById((prev) => ({ ...prev, ...avatarsPayload.avatars }));
      }
    },
    [getSupabaseAuthHeaders],
  );

  const loadCurrentSession = useCallback(async () => {
    if (!supabase) {
      setStatus("Supabase no esta configurado en este entorno.");
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setStatus(error.message);
      return;
    }

    const id = data.session?.user?.id ?? null;
    setUserId(id);
    if (!id) {
      setStatus("Necesitas iniciar sesion para usar Chats.");
      return;
    }

    const { data: profileData } = await supabase.from("profiles").select("current_lug_id").eq("id", id).maybeSingle();
    const currentLugId = String((profileData as { current_lug_id?: unknown } | null)?.current_lug_id ?? "").trim();
    if (currentLugId) {
      const { data: membersData, error: membersError } = await supabase.rpc("get_lug_members_current", { target_lug_id: currentLugId });
      if (membersError) {
        setStatus(membersError.message);
      } else {
        const members: LugMemberItem[] = (membersData ?? [])
          .map((row: unknown) => ({
            id: String((row as { id?: unknown }).id ?? "").trim(),
            full_name: String((row as { full_name?: unknown }).full_name ?? "Usuario").trim() || "Usuario",
            avatar_key: (() => {
              const value = String((row as { avatar_key?: unknown }).avatar_key ?? "").trim();
              return value || null;
            })(),
          }))
          .filter((row: LugMemberItem) => row.id);
        setLugMembers(members);
        setNameById((prev) => {
          const next = { ...prev };
          members.forEach((member: LugMemberItem) => {
            next[member.id] = member.full_name;
          });
          return next;
        });
        setAvatarById((prev) => {
          const next = { ...prev };
          members.forEach((member: LugMemberItem) => {
            if (member.avatar_key) {
              next[member.id] = member.avatar_key;
            }
          });
          return next;
        });
      }
    }
  }, [supabase]);

  const loadRooms = useCallback(async () => {
    if (!supabase || !userId) {
      return;
    }

    setRoomsLoading(true);
    const { data, error } = await supabase.rpc("chat_list_rooms_current", { p_limit: 300 });

    if (error) {
      setStatus(error.message);
      setRoomsLoading(false);
      return;
    }

    const rows: ChatRoomItem[] = (data ?? [])
      .map((row: unknown) => ({
        room_id: String((row as { room_id?: unknown }).room_id ?? "").trim(),
        room_type: normalizeRoomType(String((row as { room_type?: unknown }).room_type ?? "group")),
        room_name: (() => {
          const value = String((row as { room_name?: unknown }).room_name ?? "").trim();
          return value || null;
        })(),
        member_role: String((row as { member_role?: unknown }).member_role ?? "member") as ChatRoomItem["member_role"],
        participant_ids: Array.isArray((row as { participant_ids?: unknown }).participant_ids)
          ? ((row as { participant_ids?: unknown[] }).participant_ids ?? []).map((value) => String(value ?? "").trim()).filter(Boolean)
          : [],
        last_message_id: (() => {
          const value = String((row as { last_message_id?: unknown }).last_message_id ?? "").trim();
          return value || null;
        })(),
        last_message_sender_id: (() => {
          const value = String((row as { last_message_sender_id?: unknown }).last_message_sender_id ?? "").trim();
          return value || null;
        })(),
        last_message_content: (() => {
          const value = String((row as { last_message_content?: unknown }).last_message_content ?? "");
          return value || null;
        })(),
        last_message_at: (() => {
          const value = String((row as { last_message_at?: unknown }).last_message_at ?? "").trim();
          return value || null;
        })(),
        unread_count: Math.max(0, Number((row as { unread_count?: unknown }).unread_count ?? 0) || 0),
      }))
      .filter((row: ChatRoomItem) => row.room_id);

    setRooms(rows);

    if (!selectedRoomId || !rows.some((row) => row.room_id === selectedRoomId)) {
      setSelectedRoomId(rows[0]?.room_id ?? null);
    }

    const idsToLoad = rows.flatMap((room) => [
      ...(room.participant_ids ?? []),
      ...(room.last_message_sender_id ? [room.last_message_sender_id] : []),
    ]);
    void loadIdentityMaps(idsToLoad);

    setRoomsLoading(false);
  }, [loadIdentityMaps, selectedRoomId, supabase, userId]);

  const markRoomAsRead = useCallback(
    async (roomId: string, lastMessageId?: string | null) => {
      if (!supabase || !roomId) {
        return;
      }
      const { error } = await supabase.rpc("chat_mark_room_read", {
        p_room_id: roomId,
        p_last_message_id: lastMessageId ?? null,
      });
      if (error) {
        setStatus(error.message);
      }
    },
    [supabase],
  );

  const loadMessages = useCallback(
    async (roomId: string, options?: { beforeCreatedAt?: string | null }) => {
      if (!supabase || !roomId) {
        return;
      }

      if (!options?.beforeCreatedAt) {
        setMessagesLoading(true);
      }

      let query = supabase
        .from("chat_messages")
        .select("message_id, room_id, sender_id, content, created_at, edited_at")
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (options?.beforeCreatedAt) {
        query = query.lt("created_at", options.beforeCreatedAt);
      }

      const { data, error } = await query;
      if (error) {
        setStatus(error.message);
        setMessagesLoading(false);
        return;
      }

    const rowsDesc: ChatMessageItem[] = (data ?? []).map((row: unknown) => ({
      message_id: String((row as { message_id?: unknown }).message_id ?? "").trim(),
        room_id: String((row as { room_id?: unknown }).room_id ?? "").trim(),
        sender_id: (() => {
          const value = String((row as { sender_id?: unknown }).sender_id ?? "").trim();
          return value || null;
        })(),
        content: String((row as { content?: unknown }).content ?? ""),
        created_at: String((row as { created_at?: unknown }).created_at ?? "").trim(),
        edited_at: (() => {
          const value = String((row as { edited_at?: unknown }).edited_at ?? "").trim();
          return value || null;
        })(),
      }));

      const rows = rowsDesc.slice().reverse();
      if (options?.beforeCreatedAt) {
        setMessages((prev) => [...rows, ...prev]);
      } else {
        setMessages(rows);
      }

      setHasOlderMessages(rowsDesc.length === PAGE_SIZE);
      setOldestMessageAt(rowsDesc[rowsDesc.length - 1]?.created_at ?? null);

      const latestMessageId = rowsDesc[0]?.message_id ?? null;
      if (latestMessageId) {
        void markRoomAsRead(roomId, latestMessageId);
      }

      void loadIdentityMaps(rows.map((row) => row.sender_id).filter((id): id is string => Boolean(id)));
      setMessagesLoading(false);
    },
    [loadIdentityMaps, markRoomAsRead, supabase],
  );

  const selectedRoom = useMemo(() => rooms.find((room) => room.room_id === selectedRoomId) ?? null, [rooms, selectedRoomId]);

  const selectedRoomTitle = useMemo(() => {
    if (!selectedRoom) {
      return "";
    }
    if (selectedRoom.room_type !== "direct") {
      return selectedRoom.room_name || "Grupo";
    }
    const otherId = selectedRoom.participant_ids.find((id) => id !== userId);
    if (!otherId) {
      return "Chat directo";
    }
    return nameById[otherId] || "Chat directo";
  }, [nameById, selectedRoom, userId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadCurrentSession();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadCurrentSession]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const handle = window.setTimeout(() => {
      void loadRooms();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadRooms, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const handle = window.setInterval(() => {
      void loadRooms();
    }, 12000);

    return () => window.clearInterval(handle);
  }, [loadRooms, userId]);

  useEffect(() => {
    if (!selectedRoomId) {
      const handle = window.setTimeout(() => {
        setMessages([]);
        setOldestMessageAt(null);
        setHasOlderMessages(false);
      }, 0);
      return () => window.clearTimeout(handle);
    }

    const handle = window.setTimeout(() => {
      void loadMessages(selectedRoomId);
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [loadMessages, selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    const targetRoomId = selectedRoomId;
    const handle = window.setTimeout(() => {
      const latest = messages[messages.length - 1]?.message_id ?? null;
      if (latest) {
        void markRoomAsRead(targetRoomId, latest);
      }
    }, 0);
    return () => window.clearTimeout(handle);
  }, [markRoomAsRead, messages, selectedRoomId]);

  useEffect(() => {
    if (!supabase || !selectedRoomId || !userId) {
      return;
    }

    const channel = supabase
      .channel(`chat-room-${selectedRoomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${selectedRoomId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const nextMessage: ChatMessageItem = {
            message_id: String(row.message_id ?? "").trim(),
            room_id: String(row.room_id ?? "").trim(),
            sender_id: (() => {
              const value = String(row.sender_id ?? "").trim();
              return value || null;
            })(),
            content: String(row.content ?? ""),
            created_at: String(row.created_at ?? "").trim(),
            edited_at: (() => {
              const value = String(row.edited_at ?? "").trim();
              return value || null;
            })(),
          };

          if (!nextMessage.message_id) {
            return;
          }

          setMessages((prev) => {
            if (prev.some((item) => item.message_id === nextMessage.message_id)) {
              return prev;
            }
            return [...prev, nextMessage];
          });

          if (nextMessage.sender_id !== userId) {
            void markRoomAsRead(selectedRoomId, nextMessage.message_id);
          }

          void loadIdentityMaps(nextMessage.sender_id ? [nextMessage.sender_id] : []);
          void loadRooms();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `room_id=eq.${selectedRoomId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const messageId = String(row.message_id ?? "").trim();
          if (!messageId) {
            return;
          }
          setMessages((prev) =>
            prev.map((item) =>
              item.message_id === messageId
                ? {
                    ...item,
                    content: String(row.content ?? item.content),
                    edited_at: (() => {
                      const value = String(row.edited_at ?? "").trim();
                      return value || null;
                    })(),
                  }
                : item,
            ),
          );
          void loadRooms();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadIdentityMaps, loadRooms, markRoomAsRead, selectedRoomId, supabase, userId]);

  const startDirectChat = useCallback(async () => {
    if (!supabase || !selectedDirectMemberId) {
      return;
    }

    const { data, error } = await supabase.rpc("chat_get_or_create_direct_room", { p_other_user_id: selectedDirectMemberId });
    if (error) {
      setStatus(error.message);
      return;
    }

    const roomId = String(data ?? "").trim();
    if (!roomId) {
      return;
    }

    setSelectedRoomId(roomId);
    setSelectedDirectMemberId("");
    await loadRooms();
  }, [loadRooms, selectedDirectMemberId, supabase]);

  const createGroupChat = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const memberIds = Object.entries(groupMemberIds)
      .filter(([, checked]) => checked)
      .map(([id]) => id)
      .filter(Boolean);

    const { data, error } = await supabase.rpc("chat_create_group_room", {
      p_name: groupNameInput,
      p_member_ids: memberIds,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    const roomId = String(data ?? "").trim();
    if (!roomId) {
      return;
    }

    setGroupNameInput("");
    setGroupMemberIds({});
    setSelectedRoomId(roomId);
    await loadRooms();
  }, [groupMemberIds, groupNameInput, loadRooms, supabase]);

  const sendMessage = useCallback(async () => {
    const text = composerText.trim();
    if (!supabase || !selectedRoomId || !userId || !text || sending) {
      return;
    }

    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      room_id: selectedRoomId,
      sender_id: userId,
      message_type: "text",
      content: text,
    });

    if (error) {
      setStatus(error.message);
      setSending(false);
      return;
    }

    setComposerText("");
    setSending(false);
  }, [composerText, selectedRoomId, sending, supabase, userId]);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedRoomId || !oldestMessageAt || !hasOlderMessages) {
      return;
    }
    await loadMessages(selectedRoomId, { beforeCreatedAt: oldestMessageAt });
  }, [hasOlderMessages, loadMessages, oldestMessageAt, selectedRoomId]);

  const selectableLugMembers = useMemo(() => lugMembers.filter((member) => member.id !== userId), [lugMembers, userId]);

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4">
      <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-3">
        <header className="rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-boogaloo text-3xl text-slate-900">Chats</h1>
              <p className="text-xs text-slate-600">Directos, grupales y en tiempo real.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Volver
            </button>
          </div>
          {status ? <p className="mt-2 text-xs text-slate-700">{status}</p> : null}
        </header>

        <div className="grid min-h-[78vh] grid-cols-1 gap-3 md:grid-cols-[360px,1fr]">
          <aside className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Nuevo directo</p>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDirectMemberId}
                    onChange={(event) => setSelectedDirectMemberId(event.target.value)}
                    className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
                  >
                    <option value="">Elegir miembro</option>
                    {selectableLugMembers.map((member) => (
                      <option key={`direct-member-${member.id}`} value={member.id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void startDirectChat()}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Abrir
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Nuevo grupo</p>
                <input
                  type="text"
                  value={groupNameInput}
                  onChange={(event) => setGroupNameInput(event.target.value)}
                  placeholder="Nombre del grupo"
                  className="mb-2 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
                />
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                  {selectableLugMembers.length === 0 ? <p className="text-xs text-slate-500">Sin miembros disponibles.</p> : null}
                  {selectableLugMembers.map((member) => (
                    <label key={`group-member-${member.id}`} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(groupMemberIds[member.id])}
                        onChange={(event) =>
                          setGroupMemberIds((prev) => ({
                            ...prev,
                            [member.id]: event.target.checked,
                          }))
                        }
                      />
                      <span className="truncate">{member.full_name}</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void createGroupChat()}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Crear grupo
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Conversaciones</p>
                <button
                  type="button"
                  onClick={() => void loadRooms()}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                >
                  Recargar
                </button>
              </div>

              <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {roomsLoading ? <p className="text-xs text-slate-500">Cargando chats...</p> : null}
                {!roomsLoading && rooms.length === 0 ? <p className="text-xs text-slate-500">Todavia no tenes chats.</p> : null}
                {rooms.map((room) => {
                  const isSelected = room.room_id === selectedRoomId;
                  const title = (() => {
                    if (room.room_type !== "direct") {
                      return room.room_name || "Grupo";
                    }
                    const otherId = room.participant_ids.find((id) => id !== userId);
                    if (!otherId) return "Chat directo";
                    return nameById[otherId] || "Chat directo";
                  })();

                  const preview = room.last_message_content || "Sin mensajes";
                  return (
                    <button
                      key={`room-${room.room_id}`}
                      type="button"
                      onClick={() => setSelectedRoomId(room.room_id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{title}</p>
                        {room.unread_count > 0 ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isSelected ? "bg-white text-slate-900" : "bg-slate-900 text-white"}`}>
                            {room.unread_count}
                          </span>
                        ) : null}
                      </div>
                      <p className={`mt-1 truncate text-xs ${isSelected ? "text-white/80" : "text-slate-500"}`}>{preview}</p>
                      <p className={`mt-1 text-[11px] ${isSelected ? "text-white/70" : "text-slate-400"}`}>{formatRelativeTime(room.last_message_at)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="rounded-xl border border-slate-300 bg-white shadow-sm">
            {!selectedRoom ? (
              <div className="flex h-full min-h-[380px] items-center justify-center p-6">
                <p className="text-sm text-slate-500">Selecciona o crea una conversacion para empezar.</p>
              </div>
            ) : (
              <div className="flex h-full min-h-[380px] flex-col">
                <header className="border-b border-slate-200 px-4 py-3">
                  <p className="truncate text-base font-semibold text-slate-900">{selectedRoomTitle}</p>
                  <p className="text-xs text-slate-500">{selectedRoom.room_type === "direct" ? "Directo" : "Grupal"}</p>
                </header>

                <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-3 sm:px-4">
                  {hasOlderMessages ? (
                    <div className="mb-3 text-center">
                      <button
                        type="button"
                        onClick={() => void loadOlderMessages()}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Cargar anteriores
                      </button>
                    </div>
                  ) : null}

                  {messagesLoading && messages.length === 0 ? <p className="text-xs text-slate-500">Cargando mensajes...</p> : null}
                  {!messagesLoading && messages.length === 0 ? <p className="text-xs text-slate-500">No hay mensajes todavia.</p> : null}

                  <div className="space-y-2">
                    {messages.map((message) => {
                      const isMine = message.sender_id === userId;
                      const senderName = message.sender_id ? nameById[message.sender_id] || "Usuario" : "Sistema";
                      const avatarKey = message.sender_id ? avatarById[message.sender_id] : null;
                      return (
                        <div key={`message-${message.message_id}`} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[88%] rounded-lg border px-3 py-2 ${isMine ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"}`}>
                            <div className="mb-1 flex items-center gap-2">
                              {!isMine ? (
                                <Image
                                  src={`/api/avatar/${avatarKey || "Cabeza_01.png"}`}
                                  alt={senderName}
                                  width={20}
                                  height={20}
                                  unoptimized
                                  className="h-5 w-5 object-contain"
                                />
                              ) : null}
                              <p className={`text-[11px] font-semibold ${isMine ? "text-white/90" : "text-slate-600"}`}>{senderName}</p>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                            <p className={`mt-1 text-[10px] ${isMine ? "text-white/70" : "text-slate-400"}`}>{formatRelativeTime(message.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <footer className="border-t border-slate-200 bg-white p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={composerText}
                      onChange={(event) => setComposerText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Escribe un mensaje..."
                      className="max-h-28 min-h-[42px] flex-1 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={sending || !composerText.trim()}
                      className="rounded-md border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Enviar
                    </button>
                  </div>
                </footer>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
