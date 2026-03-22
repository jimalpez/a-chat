"use client";

import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";
export type ChatMode = "dm" | "group";

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface ChatReaction {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
}

export type MessageType = "text" | "image" | "file" | "audio";
export type MessageStatus = "sent" | "delivered" | "read";

export interface ChatMessage {
  id: string;
  content: string;
  type?: MessageType;
  status?: MessageStatus;
  senderId: string;
  receiverId: string;
  createdAt: string;
  editedAt?: string;
  read?: boolean;
  encrypted?: boolean;
  nonce?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  linkUrl?: string;
  linkTitle?: string;
  linkDesc?: string;
  linkImage?: string;
  sender: { id: string; name: string; image: string | null };
  reactions?: ChatReaction[];
}

export interface ChatGroup {
  id: string;
  name: string;
  image: string | null;
  memberCount: number;
}

interface ChatState {
  // Chat mode
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;

  // DM
  selectedUser: ChatUser | null;
  setSelectedUser: (user: ChatUser | null) => void;

  // Group
  selectedGroup: ChatGroup | null;
  setSelectedGroup: (group: ChatGroup | null) => void;

  // Online users
  onlineUsers: Set<string>;
  setOnlineUsers: (users: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;

  // Messages (DM + group share the same array for the active conversation)
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  prependMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  removeMessage: (messageId: string) => void;
  updateMessageContent: (messageId: string, content: string) => void;
  replaceOptimisticMessage: (tempId: string, realMessage: ChatMessage) => void;
  markMessagesAsRead: (senderId: string) => void;
  addReaction: (messageId: string, reaction: ChatReaction) => void;
  removeReaction: (messageId: string, reactionId: string) => void;

  // Pagination
  hasMoreMessages: boolean;
  setHasMoreMessages: (has: boolean) => void;

  // Typing
  typingUsers: Set<string>;
  setUserTyping: (userId: string, isTyping: boolean) => void;

  // Unread
  unreadCounts: Record<string, number>;
  setUnreadCounts: (counts: Record<string, number>) => void;
  incrementUnread: (userId: string) => void;
  clearUnread: (userId: string) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Theme
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chatMode: "dm",
  setChatMode: (mode) => set({ chatMode: mode }),

  selectedUser: null,
  setSelectedUser: (user) => set({ selectedUser: user, selectedGroup: null, chatMode: "dm", messages: [], hasMoreMessages: true }),

  selectedGroup: null,
  setSelectedGroup: (group) => set({ selectedGroup: group, selectedUser: null, chatMode: "group", messages: [], hasMoreMessages: true }),

  onlineUsers: new Set<string>(),
  setOnlineUsers: (users) => set({ onlineUsers: new Set(users) }),
  addOnlineUser: (userId) =>
    set((state) => ({ onlineUsers: new Set([...state.onlineUsers, userId]) })),
  removeOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  messages: [],
  setMessages: (messages) => set({ messages }),
  prependMessages: (messages) =>
    set((state) => ({ messages: [...messages, ...state.messages] })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),
  updateMessageContent: (messageId, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content } : m,
      ),
    })),
  replaceOptimisticMessage: (tempId, realMessage) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === tempId ? realMessage : m,
      ),
    })),
  markMessagesAsRead: (senderId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.senderId === senderId ? { ...m, read: true } : m,
      ),
    })),
  addReaction: (messageId, reaction) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, reactions: [...(m.reactions ?? []), reaction] }
          : m,
      ),
    })),
  removeReaction: (messageId, reactionId) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, reactions: (m.reactions ?? []).filter((r) => r.id !== reactionId) }
          : m,
      ),
    })),

  hasMoreMessages: true,
  setHasMoreMessages: (has) => set({ hasMoreMessages: has }),

  typingUsers: new Set<string>(),
  setUserTyping: (userId, isTyping) =>
    set((state) => {
      const next = new Set(state.typingUsers);
      if (isTyping) next.add(userId);
      else next.delete(userId);
      return { typingUsers: next };
    }),

  unreadCounts: {},
  setUnreadCounts: (counts) => set({ unreadCounts: counts }),
  incrementUnread: (userId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: (state.unreadCounts[userId] ?? 0) + 1,
      },
    })),
  clearUnread: (userId) =>
    set((state) => {
      const next = { ...state.unreadCounts };
      delete next[userId];
      return { unreadCounts: next };
    }),

  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  themeMode: "system",
  setThemeMode: (mode) => set({ themeMode: mode }),
  isDark: false,
  setIsDark: (dark) => set({ isDark: dark }),

  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
