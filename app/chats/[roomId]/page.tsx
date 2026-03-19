import ChatsClient from "../ChatsClient";

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const resolved = await params;
  const roomId = String(resolved.roomId ?? "").trim();
  return <ChatsClient initialRoomId={roomId || undefined} />;
}
