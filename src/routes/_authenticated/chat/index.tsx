import { createFileRoute, redirect } from "@tanstack/react-router";
import { listChatThreads, createChatThread } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [{ title: "ถาม-ตอบ KB · RathCoWork" }] }),
  loader: async () => {
    const { threads } = await listChatThreads();
    if (threads.length > 0) {
      throw redirect({ to: "/chat/$threadId", params: { threadId: threads[0].id } });
    }
    const { thread } = await createChatThread({ data: {} });
    throw redirect({ to: "/chat/$threadId", params: { threadId: thread.id } });
  },
  component: () => null,
});
