"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { useChatStore } from "@/lib/store";
import { getSocket, isSocketConnected } from "@/lib/socket";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

function MessagesSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 py-5 sm:px-5">
      {/* Received message skeleton */}
      <div className="flex items-end gap-2">
        <div className="skeleton h-7 w-7 shrink-0 rounded-full" />
        <div className="space-y-1.5">
          <div className="skeleton h-10 w-48 rounded-2xl rounded-bl-md" />
          <div className="skeleton h-10 w-36 rounded-2xl rounded-bl-md" />
        </div>
      </div>
      {/* Own message skeleton */}
      <div className="flex justify-end">
        <div className="space-y-1.5">
          <div className="skeleton h-10 w-52 rounded-2xl rounded-br-md" />
        </div>
      </div>
      {/* Received */}
      <div className="flex items-end gap-2">
        <div className="skeleton h-7 w-7 shrink-0 rounded-full" />
        <div className="skeleton h-10 w-40 rounded-2xl rounded-bl-md" />
      </div>
      {/* Own */}
      <div className="flex justify-end">
        <div className="space-y-1.5">
          <div className="skeleton h-10 w-44 rounded-2xl rounded-br-md" />
          <div className="skeleton h-10 w-56 rounded-2xl rounded-br-md" />
        </div>
      </div>
      {/* Received */}
      <div className="flex items-end gap-2">
        <div className="skeleton h-7 w-7 shrink-0 rounded-full" />
        <div className="skeleton h-10 w-52 rounded-2xl rounded-bl-md" />
      </div>
    </div>
  );
}

export function ChatWindow() {
  const { data: session } = useSession();
  const {
    selectedUser,
    messages,
    setMessages,
    onlineUsers,
    typingUsers,
    clearUnread,
    setSidebarOpen,
  } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = session?.user?.id;

  // Fetch messages — poll every 3s when socket is down, otherwise just on conversation switch
  const { data: conversationMessages, isLoading } = api.message.getConversation.useQuery(
    { otherUserId: selectedUser?.id ?? "" },
    {
      enabled: !!selectedUser,
      refetchOnWindowFocus: false,
      refetchInterval: isSocketConnected() ? false : 3000,
    },
  );

  // Sync fetched messages to Zustand store, preserving optimistic (temp) messages
  useEffect(() => {
    if (conversationMessages) {
      const fetched = conversationMessages.map(
        (m: {
          id: string;
          content: string;
          senderId: string;
          receiverId: string;
          createdAt: Date | string;
          read: boolean;
          sender: { id: string; name: string; image: string | null };
        }) => ({
          id: m.id,
          content: m.content,
          senderId: m.senderId,
          receiverId: m.receiverId,
          createdAt:
            m.createdAt instanceof Date
              ? m.createdAt.toISOString()
              : String(m.createdAt),
          read: m.read,
          sender: m.sender,
        }),
      );
      // Keep any optimistic messages that haven't been confirmed yet
      const currentMessages = useChatStore.getState().messages;
      const optimistic = currentMessages.filter((m) => m.id.startsWith("temp-"));
      const unconfirmedOptimistic = optimistic.filter(
        (om) => !fetched.some((fm) => fm.content === om.content && fm.senderId === om.senderId),
      );
      setMessages([...fetched, ...unconfirmedOptimistic]);
    }
  }, [conversationMessages, setMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when viewing a conversation and when new messages arrive
  const markAsReadMutation = api.message.markAsRead.useMutation();
  const hasUnreadFromSelectedUser = selectedUser
    ? messages.some(
        (m) => m.senderId === selectedUser.id && m.read === false,
      )
    : false;

  useEffect(() => {
    if (selectedUser && currentUserId) {
      clearUnread(selectedUser.id);
      const socket = getSocket();
      if (socket && isSocketConnected()) {
        socket.emit("mark-read", { senderId: selectedUser.id });
      } else {
        markAsReadMutation.mutate({ senderId: selectedUser.id });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, currentUserId, clearUnread, hasUnreadFromSelectedUser]);

  // Empty state — shown on desktop when no user selected
  if (!selectedUser) {
    return (
      <div className="hidden h-full flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30 md:flex dark:from-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 shadow-sm dark:from-blue-900/30 dark:to-indigo-900/30">
            <svg
              className="h-10 w-10 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
            Select a conversation
          </h3>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Choose a user from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  const isOnline = onlineUsers.has(selectedUser.id);
  const isTyping = typingUsers.has(selectedUser.id);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Chat header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200/80 bg-white/80 px-4 py-3 glass dark:border-gray-700/50 dark:bg-gray-900/80">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl p-2 text-gray-500 transition-colors active:bg-gray-200 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:active:bg-gray-700 dark:hover:bg-gray-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <Avatar name={selectedUser.name} image={selectedUser.image} online={isOnline} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">
            {selectedUser.name}
          </h2>
          <p className="text-xs">
            {isTyping ? (
              <span className="font-medium text-blue-500">typing...</span>
            ) : isOnline ? (
              <span className="text-emerald-500">Online</span>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">Offline</span>
            )}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100/50 px-4 py-4 sm:px-5 sm:py-5 dark:from-gray-800 dark:to-gray-900">
        {isLoading && messages.length === 0 ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700/50">
              <svg className="h-7 w-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
              No messages yet
            </p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-600">
              Say hello to {selectedUser.name}!
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isOwn = msg.senderId === currentUserId;
              const prevMsg = messages[idx - 1];
              const showAvatar = !isOwn && prevMsg?.senderId !== msg.senderId;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                />
              );
            })}
            {isTyping && (
              <div className="mb-1.5 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-[10px] font-bold text-white dark:from-gray-500 dark:to-gray-600">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100 dark:bg-gray-700/80 dark:ring-gray-600/30">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div className="h-2" />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {currentUserId && <MessageInput currentUserId={currentUserId} />}
    </div>
  );
}
