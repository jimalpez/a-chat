"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { useChatStore } from "@/lib/store";
import { getSocket } from "@/lib/socket";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

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

  // Fetch messages for the selected conversation
  const { data: conversationMessages } = api.message.getConversation.useQuery(
    { otherUserId: selectedUser?.id ?? "" },
    {
      enabled: !!selectedUser,
      refetchOnWindowFocus: false,
    },
  );

  // Sync fetched messages to Zustand store
  useEffect(() => {
    if (conversationMessages) {
      setMessages(
        conversationMessages.map((m: { id: string; content: string; senderId: string; receiverId: string; createdAt: Date | string; read: boolean; sender: { id: string; name: string; image: string | null } }) => ({
          id: m.id,
          content: m.content,
          senderId: m.senderId,
          receiverId: m.receiverId,
          createdAt: m.createdAt instanceof Date
            ? m.createdAt.toISOString()
            : String(m.createdAt),
          read: m.read,
          sender: m.sender,
        })),
      );
    }
  }, [conversationMessages, setMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (selectedUser && currentUserId) {
      clearUnread(selectedUser.id);
      const socket = getSocket();
      socket.emit("mark-read", { senderId: selectedUser.id });
    }
  }, [selectedUser, currentUserId, clearUnread]);

  // Empty state — shown on desktop when no user selected
  if (!selectedUser) {
    return (
      <div className="hidden h-full flex-col items-center justify-center bg-gray-50 md:flex dark:bg-gray-800">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
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
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Choose a user from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  const isOnline = onlineUsers.has(selectedUser.id);
  const isTyping = typingUsers.has(selectedUser.id);

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2.5 safe-top dark:border-gray-700 dark:bg-gray-900">
        {/* Mobile back button */}
        <button
          onClick={() => {
            setSidebarOpen(true);
          }}
          className="rounded-lg p-2 text-gray-500 active:bg-gray-200 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:active:bg-gray-700 dark:hover:bg-gray-800"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <Avatar name={selectedUser.name} image={selectedUser.image} online={isOnline} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-gray-900 dark:text-white">
            {selectedUser.name}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isTyping ? (
              <span className="text-blue-500">typing...</span>
            ) : isOnline ? (
              "Online"
            ) : (
              "Offline"
            )}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 sm:px-4 sm:py-4 dark:bg-gray-800">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No messages yet. Say hello!
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isOwn = msg.senderId === currentUserId;
              const prevMsg = messages[idx - 1];
              const showAvatar =
                !isOwn && prevMsg?.senderId !== msg.senderId;

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
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 dark:bg-gray-700">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message input */}
      {currentUserId && <MessageInput currentUserId={currentUserId} />}
    </div>
  );
}
