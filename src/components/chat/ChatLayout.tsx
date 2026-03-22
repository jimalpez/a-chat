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
  } = useChatStore();

  // On desktop, always show sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarOpen]);

  // Fetch unread counts — merge with local state to preserve real-time increments
  const { data: unreadCounts, dataUpdatedAt: unreadUpdatedAt } = api.message.getUnreadCounts.useQuery(
    undefined,
    { enabled: !!session, refetchInterval: isSocketConnected() ? false : 3000 },
  );

  useEffect(() => {
    if (unreadCounts) {
      const state = useChatStore.getState();
      // Merge: take the max of server count and local count for each user
      // This prevents the poll from erasing local increments before they sync to server
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

  // Socket connection — optional enhancement layer
  useEffect(() => {
    if (!session?.user?.id) return;

    const socket = connectSocket(session.user.id);
    // If no socket URL is configured, skip socket setup entirely
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
        // If this is an echo of our own message, replace the optimistic one
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
        // Keep query cache in sync with socket data
        void utils.message.getConversation.invalidate();
      } else if (message.senderId !== currentUserId && message.receiverId === currentUserId) {
        incrementUnread(message.senderId);
        playNotificationSound();
        // Invalidate queries so sidebar previews and unread counts update
        void utils.message.getUnreadCounts.invalidate();
        void utils.group.getMyGroups.invalidate();
      }
    });

    // Auto-clear typing indicator after 3s in case disconnect happens mid-typing
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

    // When other user reads our messages — update read status instantly
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

  const showChatOnMobile = (selectedUser ?? selectedGroup) && !sidebarOpen;

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="h-screen-safe flex bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <div
          className={`
            ${sidebarOpen ? "flex" : "hidden"}
            w-full flex-col border-r border-gray-200/80
            md:flex md:w-80 md:min-w-[320px]
            dark:border-gray-700/50
          `}
        >
          <Sidebar />
        </div>

        {/* Chat window */}
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
