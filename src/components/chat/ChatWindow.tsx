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
import { motion } from "framer-motion";

function MessagesSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-5 py-6 sm:px-8">
      <div className="flex items-end gap-2.5">
        <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-11 w-52 rounded-2xl rounded-bl-md" />
          <div className="skeleton h-11 w-36 rounded-2xl rounded-bl-md" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="skeleton h-11 w-56 rounded-2xl rounded-br-md" />
      </div>
      <div className="flex items-end gap-2.5">
        <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
        <div className="skeleton h-11 w-44 rounded-2xl rounded-bl-md" />
      </div>
      <div className="flex justify-end">
        <div className="skeleton h-11 w-48 rounded-2xl rounded-br-md" />
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
  replyToId?: string | null;
  replyTo?: { id: string; content: string; sender: { id: string; name: string } } | null;
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
    replyToId: m.replyToId ?? null,
    replyTo: m.replyTo ?? null,
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

  const dmQuery = api.message.getConversation.useQuery(
    { otherUserId: selectedUser?.id ?? "", limit: 30 },
    { enabled: !!isDM, refetchOnWindowFocus: false, refetchInterval: isSocketConnected() ? false : 2000 },
  );

  const groupQuery = api.group.getMessages.useQuery(
    { groupId: selectedGroup?.id ?? "", limit: 30 },
    { enabled: !!isGroup, refetchOnWindowFocus: false, refetchInterval: 2000 },
  );

  const activeQuery = isDM ? dmQuery : isGroup ? groupQuery : null;
  const conversationData = activeQuery?.data;
  const isLoading = activeQuery?.isLoading ?? false;
  const dataUpdatedAt = isDM ? dmQuery.dataUpdatedAt : groupQuery.dataUpdatedAt;

  const conversationKey = selectedUser?.id ?? selectedGroup?.id ?? "";
  useEffect(() => {
    if (!conversationData) return;
    const fetched = conversationData.messages.map(mapMessage);
    setHasMoreMessages(!!conversationData.nextCursor);

    const currentMessages = useChatStore.getState().messages;
    const optimistic = currentMessages.filter((m) => m.id.startsWith("temp-"));
    const unconfirmedOptimistic = optimistic.filter(
      (om) => !fetched.some((fm) => fm.content === om.content && fm.senderId === om.senderId),
    );

    if (!isInitialLoad.current && currentUserId) {
      const currentIds = new Set(currentMessages.map((m) => m.id));
      const hasNewFromOther = fetched.some(
        (m) => m.senderId !== currentUserId && !currentIds.has(m.id),
      );
      if (hasNewFromOther) playNotificationSound();
    }

    setMessages([...fetched, ...unconfirmedOptimistic]);

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt, conversationKey]);

  useEffect(() => {
    isInitialLoad.current = true;
    if (selectedUser) void utils.message.getConversation.invalidate();
    if (selectedGroup) void utils.group.getMessages.invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.id, selectedGroup?.id]);

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
        result = await utils.message.getConversation.fetch({ otherUserId: selectedUser.id, cursor: cursorRef.current, limit: 30 });
      } else if (isGroup) {
        result = await utils.group.getMessages.fetch({ groupId: selectedGroup.id, cursor: cursorRef.current, limit: 30 });
      }
      if (result) {
        const older = result.messages.map(mapMessage);
        prependMessages(older);
        setHasMoreMessages(!!result.nextCursor);
        cursorRef.current = result.nextCursor ?? undefined;
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
        });
      }
    } finally {
      loadingOlder.current = false;
    }
  }, [isDM, isGroup, selectedUser, selectedGroup, hasMoreMessages, prependMessages, setHasMoreMessages, utils]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 100 && hasMoreMessages) void loadOlderMessages();
  }, [hasMoreMessages, loadOlderMessages]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const groupMarkReadMutation = api.group.markRead.useMutation({
    onSuccess: () => void utils.group.getMyGroups.invalidate(),
  });
  useEffect(() => {
    if (selectedGroup) groupMarkReadMutation.mutate({ groupId: selectedGroup.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (selectedUser) clearUnread(selectedUser.id);
    if (selectedGroup) clearUnread(selectedGroup.id);
  }, [selectedUser, selectedGroup, clearUnread]);

  // Empty State
  if (!hasTarget) {
    return (
      <div className="hidden h-full flex-col items-center justify-center bg-slate-50 md:flex dark:bg-slate-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20">
            <svg className="h-10 w-10 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Select a conversation</h3>
          <p className="mt-2 max-w-xs text-sm text-slate-400 dark:text-slate-500">Pick someone from the sidebar to start chatting</p>
        </motion.div>
      </div>
    );
  }

  const headerName = selectedUser?.name ?? selectedGroup?.name ?? "";
  const headerImage = selectedUser?.image ?? selectedGroup?.image ?? null;
  const isOnline = selectedUser ? onlineUsers.has(selectedUser.id) : false;
  const isTyping = selectedUser ? typingUsers.has(selectedUser.id) : false;

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white px-4 py-3.5 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        {/* Back button (mobile) */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (isDM) useChatStore.getState().setSelectedUser(null);
            if (isGroup) useChatStore.getState().setSelectedGroup(null);
            setSidebarOpen(true);
          }}
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>

        <Avatar name={headerName} image={headerImage} online={isDM ? isOnline : undefined} colorSeed={selectedUser?.id ?? selectedGroup?.id} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-bold text-slate-900 dark:text-white">{headerName}</h2>
          <div className="text-xs">
            {isGroup ? (
              <span className="text-slate-400">{selectedGroup.memberCount} members</span>
            ) : isTyping ? (
              <span className="flex items-center gap-1 font-medium text-indigo-500">
                typing
                <span className="flex gap-0.5">
                  <span className="typing-dot-1 inline-block h-1 w-1 rounded-full bg-indigo-500" />
                  <span className="typing-dot-2 inline-block h-1 w-1 rounded-full bg-indigo-500" />
                  <span className="typing-dot-3 inline-block h-1 w-1 rounded-full bg-indigo-500" />
                </span>
              </span>
            ) : isOnline ? (
              <span className="font-medium text-emerald-500">Active now</span>
            ) : (
              <span className="text-slate-400">Offline</span>
            )}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (isDM) useChatStore.getState().setSelectedUser(null);
            if (isGroup) useChatStore.getState().setSelectedGroup(null);
            setSidebarOpen(true);
          }}
          className="hidden rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 md:block dark:hover:bg-slate-800"
          title="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6"
      >
        {hasMoreMessages && messages.length > 0 && (
          <div className="flex justify-center py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-700" />
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <MessagesSkeleton />
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex h-full flex-col items-center justify-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <svg className="h-8 w-8 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No messages yet</p>
            <p className="mt-1 text-xs text-slate-400">Say hello{isDM ? ` to ${selectedUser.name}` : ""}!</p>
          </motion.div>
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
              <div className="mb-2 flex items-center gap-2.5">
                <Avatar name={selectedUser.name} image={selectedUser.image} size="xs" colorSeed={selectedUser.id} />
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm dark:bg-slate-800">
                  <div className="flex gap-1.5">
                    <span className="typing-dot-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span className="typing-dot-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span className="typing-dot-3 h-1.5 w-1.5 rounded-full bg-slate-400" />
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
