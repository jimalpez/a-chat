"use client";

import { SessionProvider } from "next-auth/react";
import { ChatLayout } from "@/components/chat/ChatLayout";

export function ChatPage() {
  return (
    <SessionProvider>
      <ChatLayout />
    </SessionProvider>
  );
}
