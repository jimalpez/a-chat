"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useChatStore, type ChatMessage } from "@/lib/store";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { api } from "@/trpc/react";
import { Sidebar } from "./Sidebar";
import { ChatWindow } from "./ChatWindow";

export function ChatLayout() {
  const { data: session } = useSession();
  const {
    selectedUser,
    addMessage,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    setUserTyping,
    incrementUnread,
    darkMode,
    sidebarOpen,
    setSidebarOpen,
  } = useChatStore();

  // On mobile: start with sidebar visible, hide chat. On desktop: both visible.
  useEffect(() => {
    const handleResize = () => {
      // On desktop, always show sidebar
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarOpen]);

  // Fetch initial unread counts
  const { data: unreadCounts } = api.message.getUnreadCounts.useQuery(
    undefined,
    { enabled: !!session },
  );

  useEffect(() => {
    if (unreadCounts) {
      useChatStore.getState().setUnreadCounts(unreadCounts);
    }
  }, [unreadCounts]);

  // Socket connection and event handling
  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = connectSocket(session.user.id);

    socket.on("online-users", (userIds: string[]) => {
      setOnlineUsers(userIds);
    });

    socket.on("user-online", (userId: string) => {
      addOnlineUser(userId);
    });

    socket.on("user-offline", (userId: string) => {
      removeOnlineUser(userId);
    });

    socket.on("receive-message", (message: ChatMessage) => {
      const state = useChatStore.getState();
      const currentUserId = session.user.id;

      const isCurrentConversation =
        state.selectedUser &&
        ((message.senderId === state.selectedUser.id &&
          message.receiverId === currentUserId) ||
          (message.senderId === currentUserId &&
            message.receiverId === state.selectedUser.id));

      if (isCurrentConversation) {
        const exists = state.messages.some((m) => m.id === message.id);
        if (!exists) {
          addMessage(message);
        }
        if (message.senderId === state.selectedUser!.id) {
          socket.emit("mark-read", { senderId: message.senderId });
        }
      } else if (message.senderId !== currentUserId) {
        incrementUnread(message.senderId);
      }
    });

    socket.on(
      "user-typing",
      (data: { userId: string; isTyping: boolean }) => {
        setUserTyping(data.userId, data.isTyping);
      },
    );

    return () => {
      disconnectSocket();
    };
  }, [
    session?.user?.id,
    addMessage,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    setUserTyping,
    incrementUnread,
  ]);

  if (!session) return null;

  // Mobile: show sidebar OR chat (not both). Desktop: show both side by side.
  const showChatOnMobile = selectedUser && !sidebarOpen;

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="h-screen-safe flex bg-white safe-top dark:bg-gray-900">
        {/* Sidebar — full screen on mobile, fixed width on desktop */}
        <div
          className={`
            ${sidebarOpen ? "flex" : "hidden"}
            w-full flex-col
            md:flex md:w-80 md:min-w-[320px]
          `}
        >
          <Sidebar />
        </div>

        {/* Chat area — full screen on mobile, flex-1 on desktop */}
        <div
          className={`
            ${showChatOnMobile ? "flex" : "hidden"}
            min-w-0 flex-1 flex-col
            md:flex
          `}
        >
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}
