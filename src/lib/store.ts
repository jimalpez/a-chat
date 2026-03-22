"use client";

import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  read?: boolean;
  sender: { id: string; name: string; image: string | null };
}

interface ChatState {
  selectedUser: ChatUser | null;
  setSelectedUser: (user: ChatUser | null) => void;

  onlineUsers: Set<string>;
  setOnlineUsers: (users: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;

  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  removeMessage: (messageId: string) => void;
  replaceOptimisticMessage: (tempId: string, realMessage: ChatMessage) => void;

  typingUsers: Set<string>;
  setUserTyping: (userId: string, isTyping: boolean) => void;

  unreadCounts: Record<string, number>;
  setUnreadCounts: (counts: Record<string, number>) => void;
  incrementUnread: (userId: string) => void;
  clearUnread: (userId: string) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;

  // Mobile sidebar — defaults to true on desktop, false handled by ChatLayout on mount
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  selectedUser: null,
  setSelectedUser: (user) => set({ selectedUser: user }),

  onlineUsers: new Set<string>(),
  setOnlineUsers: (users) => set({ onlineUsers: new Set(users) }),
  addOnlineUser: (userId) =>
    set((state) => ({
      onlineUsers: new Set([...state.onlineUsers, userId]),
    })),
  removeOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),
  replaceOptimisticMessage: (tempId, realMessage) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === tempId ? realMessage : m,
      ),
    })),

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

  // Start with sidebar visible — ChatLayout will close it on mobile mount
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
