"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useChatStore, type ChatMessage } from "@/lib/store";
import { connectSocket, disconnectSocket, isSocketConnected } from "@/lib/socket";
import { api } from "@/trpc/react";
import { useTheme } from "@/hooks/useTheme";
import { playNotificationSound } from "@/lib/notification-sound";
import { Sidebar } from "./Sidebar";
import { ChatWindow } from "./ChatWindow";
import { ProfilePage } from "./ProfilePage";
import { BottomNav } from "./BottomNav";

export function ChatLayout() {
  const { data: session } = useSession();
  const { isDark } = useTheme();
  const utils = api.useUtils();
  const {
    selectedUser,
    selectedGroup,
    addMessage,
    replaceOptimisticMessage,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    setUserTyping,
    incrementUnread,
    sidebarOpen,
    setSidebarOpen,
    activeView,
  } = useChatStore();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarOpen]);

  const { data: unreadCounts, dataUpdatedAt: unreadUpdatedAt } = api.message.getUnreadCounts.useQuery(
    undefined,
    { enabled: !!session, refetchInterval: isSocketConnected() ? false : 3000 },
  );

  useEffect(() => {
    if (unreadCounts) {
      const state = useChatStore.getState();
      const merged = { ...unreadCounts };
      for (const [userId, localCount] of Object.entries(state.unreadCounts)) {
        const serverCount = unreadCounts[userId] ?? 0;
        if (localCount > serverCount) {
          merged[userId] = localCount;
        }
      }
      state.setUnreadCounts(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadUpdatedAt]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = connectSocket(session.user.id);
    if (!socket) return;

    socket.on("online-users", (userIds: string[]) => {
      setOnlineUsers(userIds);
    });

    socket.on("user-online", (userId: string) => {
      addOnlineUser(userId);
    });

    socket.on("user-offline", (userId: string) => {
      removeOnlineUser(userId);
    });

    socket.on("receive-message", (message: ChatMessage & { tempId?: string }) => {
      const state = useChatStore.getState();
      const currentUserId = session.user.id;

      const isCurrentConversation =
        state.selectedUser &&
        ((message.senderId === state.selectedUser.id &&
          message.receiverId === currentUserId) ||
          (message.senderId === currentUserId &&
            message.receiverId === state.selectedUser.id));

      if (isCurrentConversation) {
        if (message.tempId && message.senderId === currentUserId) {
          replaceOptimisticMessage(message.tempId, {
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            receiverId: message.receiverId,
            createdAt: message.createdAt,
            read: message.read,
            sender: message.sender,
          });
        } else {
          const exists = state.messages.some((m) => m.id === message.id);
          if (!exists) {
            addMessage(message);
            playNotificationSound();
          }
        }
        if (message.senderId === state.selectedUser!.id) {
          socket.emit("mark-read", { senderId: message.senderId });
        }
        void utils.message.getConversation.invalidate();
      } else if (message.senderId !== currentUserId && message.receiverId === currentUserId) {
        incrementUnread(message.senderId);
        playNotificationSound();
        void utils.message.getUnreadCounts.invalidate();
        void utils.group.getMyGroups.invalidate();
      }
    });

    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    socket.on(
      "user-typing",
      (data: { userId: string; isTyping: boolean }) => {
        setUserTyping(data.userId, data.isTyping);
        if (typingTimers.has(data.userId)) clearTimeout(typingTimers.get(data.userId));
        if (data.isTyping) {
          typingTimers.set(data.userId, setTimeout(() => {
            setUserTyping(data.userId, false);
            typingTimers.delete(data.userId);
          }, 3000));
        } else {
          typingTimers.delete(data.userId);
        }
      },
    );

    socket.on(
      "message-read",
      (data: { readerId: string; senderId: string }) => {
        const state = useChatStore.getState();
        if (state.selectedUser?.id === data.readerId) {
          state.markMessagesAsRead(data.readerId);
        }
        void utils.message.getConversation.invalidate();
      },
    );

    return () => {
      disconnectSocket();
    };
  }, [
    session?.user?.id,
    addMessage,
    replaceOptimisticMessage,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    setUserTyping,
    incrementUnread,
  ]);

  if (!session) return null;

  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const showChatOnMobile = activeView === "chat" && (selectedUser || selectedGroup) && !sidebarOpen;
  const showProfileOnMobile = activeView === "profile";
  const showSidebarOnMobile = activeView === "chat" && sidebarOpen;

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="h-screen-safe flex overflow-hidden bg-slate-100 dark:bg-slate-950">
        {/* Sidebar */}
        <div
          className={`
            ${showSidebarOnMobile ? "flex" : "hidden"}
            w-full flex-col
            md:flex md:w-[340px] md:min-w-[340px]
          `}
        >
          <Sidebar />
        </div>

        {/* Right panel: Chat or Profile */}
        <div
          className={`
            ${showChatOnMobile || showProfileOnMobile ? "flex" : "hidden"}
            min-w-0 flex-1 flex-col
            md:flex
          `}
        >
          {activeView === "profile" ? <ProfilePage /> : <ChatWindow />}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
