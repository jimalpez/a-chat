"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { playNotificationSound } from "@/lib/notification-sound";
import { useChatStore } from "@/lib/store";
import { getSocket, isSocketConnected } from "@/lib/socket";
import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

function MessagesSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 py-5 sm:px-5">
      <div className="flex items-end gap-2">
        <div className="skeleton h-7 w-7 shrink-0 rounded-full" />
        <div className="space-y-1.5">
          <div className="skeleton h-10 w-48 rounded-2xl rounded-bl-md" />
          <div className="skeleton h-10 w-36 rounded-2xl rounded-bl-md" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="skeleton h-10 w-52 rounded-2xl rounded-br-md" />
      </div>
      <div className="flex items-end gap-2">
        <div className="skeleton h-7 w-7 shrink-0 rounded-full" />
        <div className="skeleton h-10 w-40 rounded-2xl rounded-bl-md" />
      </div>
      <div className="flex justify-end">
        <div className="skeleton h-10 w-44 rounded-2xl rounded-br-md" />
      </div>
    </div>
  );
}

function mapMessage(m: {
  id: string;
  content: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  createdAt: Date | string;
  read?: boolean;
  encrypted?: boolean;
  nonce?: string | null;
  sender: { id: string; name: string; image: string | null };
  reactions?: { id: string; emoji: string; userId: string; messageId: string }[];
}) {
  return {
    id: m.id,
    content: m.content,
    senderId: m.senderId,
    receiverId: m.receiverId ?? m.groupId ?? "",
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
    read: m.read ?? false,
    encrypted: m.encrypted ?? false,
    nonce: m.nonce ?? undefined,
    sender: m.sender,
    reactions: m.reactions ?? [],
  };
}

export function ChatWindow() {
  const { data: session } = useSession();
  const {
    chatMode,
    selectedUser,
    selectedGroup,
    messages,
    setMessages,
    prependMessages,
    hasMoreMessages,
    setHasMoreMessages,
    markMessagesAsRead,
    onlineUsers,
    typingUsers,
    clearUnread,
    setSidebarOpen,
  } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const isInitialLoad = useRef(true);
  const currentUserId = session?.user?.id;
  const utils = api.useUtils();

  const isDM = chatMode === "dm" && selectedUser;
  const isGroup = chatMode === "group" && selectedGroup;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const hasTarget = isDM || isGroup;

  // ─── DM Messages (paginated) ─────────────────────────────
  const dmQuery = api.message.getConversation.useQuery(
    { otherUserId: selectedUser?.id ?? "", limit: 30 },
    {
      enabled: !!isDM,
      refetchOnWindowFocus: false,
      refetchInterval: isSocketConnected() ? false : 2000,
    },
  );

  // ─── Group Messages (paginated) ──────────────────────────
  const groupQuery = api.group.getMessages.useQuery(
    { groupId: selectedGroup?.id ?? "", limit: 30 },
    {
      enabled: !!isGroup,
      refetchOnWindowFocus: false,
      refetchInterval: 2000,
    },
  );

  const activeQuery = isDM ? dmQuery : isGroup ? groupQuery : null;
  const conversationData = activeQuery?.data;
  const isLoading = activeQuery?.isLoading ?? false;
  // dataUpdatedAt changes on EVERY successful fetch, even if data is identical
  const dataUpdatedAt = isDM ? dmQuery.dataUpdatedAt : groupQuery.dataUpdatedAt;

  // Sync latest page to store — triggered by dataUpdatedAt AND conversation switch
  const conversationKey = selectedUser?.id ?? selectedGroup?.id ?? "";
  useEffect(() => {
    if (!conversationData) return;
    const fetched = conversationData.messages.map(mapMessage);
    setHasMoreMessages(!!conversationData.nextCursor);

    // Merge with optimistic messages
    const currentMessages = useChatStore.getState().messages;
    const optimistic = currentMessages.filter((m) => m.id.startsWith("temp-"));
    const unconfirmedOptimistic = optimistic.filter(
      (om) => !fetched.some((fm) => fm.content === om.content && fm.senderId === om.senderId),
    );

    // Detect new incoming messages (not from self, not already in store)
    if (!isInitialLoad.current && currentUserId) {
      const currentIds = new Set(currentMessages.map((m) => m.id));
      const hasNewFromOther = fetched.some(
        (m) => m.senderId !== currentUserId && !currentIds.has(m.id),
      );
      if (hasNewFromOther) {
        playNotificationSound();
      }
    }

    setMessages([...fetched, ...unconfirmedOptimistic]);

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt, conversationKey]);

  // Reset on conversation switch — force fresh fetch
  useEffect(() => {
    isInitialLoad.current = true;
    // Invalidate to force refetch with fresh data (not stale cache)
    if (selectedUser) {
      void utils.message.getConversation.invalidate();
    }
    if (selectedGroup) {
      void utils.group.getMessages.invalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.id, selectedGroup?.id]);

  // ─── Load Older Messages (scroll up) ─────────────────────
  const loadingOlder = useRef(false);
  const cursorRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    cursorRef.current = conversationData?.nextCursor ?? undefined;
  }, [conversationData?.nextCursor]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder.current || !cursorRef.current || !hasMoreMessages) return;
    loadingOlder.current = true;

    const container = scrollContainerRef.current;
    if (container) prevScrollHeightRef.current = container.scrollHeight;

    try {
      let result;
      if (isDM) {
        result = await utils.message.getConversation.fetch({
          otherUserId: selectedUser.id,
          cursor: cursorRef.current,
          limit: 30,
        });
      } else if (isGroup) {
        result = await utils.group.getMessages.fetch({
          groupId: selectedGroup.id,
          cursor: cursorRef.current,
          limit: 30,
        });
      }

      if (result) {
        const older = result.messages.map(mapMessage);
        prependMessages(older);
        setHasMoreMessages(!!result.nextCursor);
        cursorRef.current = result.nextCursor ?? undefined;

        // Preserve scroll position
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
          }
        });
      }
    } finally {
      loadingOlder.current = false;
    }
  }, [isDM, isGroup, selectedUser, selectedGroup, hasMoreMessages, prependMessages, setHasMoreMessages, utils]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 100 && hasMoreMessages) {
      void loadOlderMessages();
    }
  }, [hasMoreMessages, loadOlderMessages]);

  // Auto-scroll to bottom on new messages (only if near bottom)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ─── Mark as Read (DM) ───────────────────────────────────
  const markAsReadMutation = api.message.markAsRead.useMutation({
    onSuccess: () => {
      if (selectedUser) markMessagesAsRead(selectedUser.id);
      void utils.message.getConversation.invalidate();
      void utils.message.getUnreadCounts.invalidate();
    },
  });

  const hasUnreadFromSelectedUser = selectedUser
    ? messages.some((m) => m.senderId === selectedUser.id && m.read === false)
    : false;

  useEffect(() => {
    if (selectedUser && currentUserId && hasUnreadFromSelectedUser) {
      clearUnread(selectedUser.id);
      const socket = getSocket();
      if (socket && isSocketConnected()) {
        socket.emit("mark-read", { senderId: selectedUser.id });
      } else {
        markAsReadMutation.mutate({ senderId: selectedUser.id });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, currentUserId, hasUnreadFromSelectedUser]);

  // ─── Mark as Read (Group) ────────────────────────────────
  const groupMarkReadMutation = api.group.markRead.useMutation({
    onSuccess: () => {
      void utils.group.getMyGroups.invalidate();
    },
  });
  useEffect(() => {
    if (selectedGroup) {
      groupMarkReadMutation.mutate({ groupId: selectedGroup.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (selectedUser) clearUnread(selectedUser.id);
    if (selectedGroup) clearUnread(selectedGroup.id);
  }, [selectedUser, selectedGroup, clearUnread]);

  // ─── Empty State ─────────────────────────────────────────
  if (!hasTarget) {
    return (
      <div className="hidden h-full flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30 md:flex dark:from-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 shadow-sm dark:from-blue-900/30 dark:to-indigo-900/30">
            <svg className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Select a conversation</h3>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Choose a user or group to start chatting</p>
        </div>
      </div>
    );
  }

  const headerName = selectedUser?.name ?? selectedGroup?.name ?? "";
  const headerImage = selectedUser?.image ?? selectedGroup?.image ?? null;
  const isOnline = selectedUser ? onlineUsers.has(selectedUser.id) : false;
  const isTyping = selectedUser ? typingUsers.has(selectedUser.id) : false;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Chat header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200/80 bg-white/80 px-4 py-3 glass dark:border-gray-700/50 dark:bg-gray-900/80">
        <Avatar name={headerName} image={headerImage} online={isDM ? isOnline : undefined} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-gray-900 dark:text-white">
            {headerName}
          </h2>
          <p className="text-xs">
            {isGroup ? (
              <span className="text-gray-400 dark:text-gray-500">{selectedGroup.memberCount} members</span>
            ) : isTyping ? (
              <span className="font-medium text-blue-500">typing...</span>
            ) : isOnline ? (
              <span className="text-emerald-500">Online</span>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">Offline</span>
            )}
          </p>
        </div>

        {/* Close conversation */}
        <button
          onClick={() => {
            if (isDM) useChatStore.getState().setSelectedUser(null);
            if (isGroup) useChatStore.getState().setSelectedGroup(null);
            setSidebarOpen(true);
          }}
          className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title="Close conversation"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100/50 px-4 py-4 sm:px-5 sm:py-5 dark:from-gray-800 dark:to-gray-900"
      >
        {/* Load more spinner */}
        {hasMoreMessages && messages.length > 0 && (
          <div className="flex justify-center py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700/50">
              <svg className="h-7 w-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No messages yet</p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-600">
              Say hello{isDM ? ` to ${selectedUser.name}` : ""}!
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isOwn = msg.senderId === currentUserId;
              const nextMsg = messages[idx + 1];
              const isLastInGroup = !isOwn && nextMsg?.senderId !== msg.senderId;

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={isOwn}
                  showAvatar={isLastInGroup}
                  currentUserId={currentUserId ?? ""}
                  showSenderName={!!isGroup && !isOwn}
                />
              );
            })}
            {isTyping && selectedUser && (
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
