"use client";

import { create } from "zustand";

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

  typingUsers: Set<string>;
  setUserTyping: (userId: string, isTyping: boolean) => void;

  unreadCounts: Record<string, number>;
  setUnreadCounts: (counts: Record<string, number>) => void;
  incrementUnread: (userId: string) => void;
  clearUnread: (userId: string) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  darkMode: boolean;
  toggleDarkMode: () => void;

  // Mobile sidebar — defaults to true on desktop, false handled by ChatLayout on mount
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

/** Detect mobile viewport */
function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
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

  darkMode: false,
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

  // Start with sidebar visible — ChatLayout will close it on mobile mount
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
