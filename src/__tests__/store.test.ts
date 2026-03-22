import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/lib/store";

describe("Chat Store (Zustand)", () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useChatStore.setState({
      selectedUser: null,
      onlineUsers: new Set(),
      messages: [],
      typingUsers: new Set(),
      unreadCounts: {},
      searchQuery: "",
      themeMode: "system",
      isDark: false,
      sidebarOpen: true,
    });
  });

  describe("selectedUser", () => {
    it("should start with no selected user", () => {
      expect(useChatStore.getState().selectedUser).toBeNull();
    });

    it("should set and clear selected user", () => {
      const user = { id: "u1", name: "Alice", email: "a@t.com", image: null };

      useChatStore.getState().setSelectedUser(user);
      expect(useChatStore.getState().selectedUser).toEqual(user);

      useChatStore.getState().setSelectedUser(null);
      expect(useChatStore.getState().selectedUser).toBeNull();
    });
  });

  describe("onlineUsers", () => {
    it("should start with empty set", () => {
      expect(useChatStore.getState().onlineUsers.size).toBe(0);
    });

    it("should set online users from array", () => {
      useChatStore.getState().setOnlineUsers(["u1", "u2", "u3"]);
      const online = useChatStore.getState().onlineUsers;

      expect(online.size).toBe(3);
      expect(online.has("u1")).toBe(true);
      expect(online.has("u2")).toBe(true);
      expect(online.has("u3")).toBe(true);
    });

    it("should add a single online user", () => {
      useChatStore.getState().setOnlineUsers(["u1"]);
      useChatStore.getState().addOnlineUser("u2");

      const online = useChatStore.getState().onlineUsers;
      expect(online.has("u1")).toBe(true);
      expect(online.has("u2")).toBe(true);
    });

    it("should remove an online user", () => {
      useChatStore.getState().setOnlineUsers(["u1", "u2"]);
      useChatStore.getState().removeOnlineUser("u1");

      const online = useChatStore.getState().onlineUsers;
      expect(online.has("u1")).toBe(false);
      expect(online.has("u2")).toBe(true);
    });

    it("should handle removing non-existent user gracefully", () => {
      useChatStore.getState().setOnlineUsers(["u1"]);
      useChatStore.getState().removeOnlineUser("u999");

      expect(useChatStore.getState().onlineUsers.size).toBe(1);
    });

    it("should deduplicate when adding existing user", () => {
      useChatStore.getState().setOnlineUsers(["u1"]);
      useChatStore.getState().addOnlineUser("u1");

      expect(useChatStore.getState().onlineUsers.size).toBe(1);
    });
  });

  describe("messages", () => {
    const msg1 = {
      id: "m1",
      content: "Hello",
      senderId: "u1",
      receiverId: "u2",
      createdAt: "2024-01-01T00:00:00Z",
      sender: { id: "u1", name: "Alice", image: null },
    };
    const msg2 = {
      id: "m2",
      content: "Hi!",
      senderId: "u2",
      receiverId: "u1",
      createdAt: "2024-01-01T00:01:00Z",
      sender: { id: "u2", name: "Bob", image: null },
    };

    it("should start with empty messages", () => {
      expect(useChatStore.getState().messages).toEqual([]);
    });

    it("should set messages array", () => {
      useChatStore.getState().setMessages([msg1, msg2]);
      expect(useChatStore.getState().messages).toHaveLength(2);
    });

    it("should add a single message to the end", () => {
      useChatStore.getState().setMessages([msg1]);
      useChatStore.getState().addMessage(msg2);

      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1]).toEqual(msg2);
    });

    it("should replace messages when setMessages is called", () => {
      useChatStore.getState().setMessages([msg1, msg2]);
      useChatStore.getState().setMessages([msg1]);

      expect(useChatStore.getState().messages).toHaveLength(1);
    });
  });

  describe("typingUsers", () => {
    it("should start with empty set", () => {
      expect(useChatStore.getState().typingUsers.size).toBe(0);
    });

    it("should add a typing user", () => {
      useChatStore.getState().setUserTyping("u1", true);
      expect(useChatStore.getState().typingUsers.has("u1")).toBe(true);
    });

    it("should remove a typing user", () => {
      useChatStore.getState().setUserTyping("u1", true);
      useChatStore.getState().setUserTyping("u1", false);
      expect(useChatStore.getState().typingUsers.has("u1")).toBe(false);
    });

    it("should handle multiple typing users", () => {
      useChatStore.getState().setUserTyping("u1", true);
      useChatStore.getState().setUserTyping("u2", true);
      useChatStore.getState().setUserTyping("u1", false);

      const typing = useChatStore.getState().typingUsers;
      expect(typing.has("u1")).toBe(false);
      expect(typing.has("u2")).toBe(true);
    });
  });

  describe("unreadCounts", () => {
    it("should start with empty counts", () => {
      expect(useChatStore.getState().unreadCounts).toEqual({});
    });

    it("should set unread counts", () => {
      useChatStore.getState().setUnreadCounts({ u1: 3, u2: 1 });
      expect(useChatStore.getState().unreadCounts).toEqual({ u1: 3, u2: 1 });
    });

    it("should increment unread count for a user", () => {
      useChatStore.getState().incrementUnread("u1");
      expect(useChatStore.getState().unreadCounts.u1).toBe(1);

      useChatStore.getState().incrementUnread("u1");
      expect(useChatStore.getState().unreadCounts.u1).toBe(2);
    });

    it("should clear unread count for a user", () => {
      useChatStore.getState().setUnreadCounts({ u1: 5, u2: 3 });
      useChatStore.getState().clearUnread("u1");

      const counts = useChatStore.getState().unreadCounts;
      expect(counts.u1).toBeUndefined();
      expect(counts.u2).toBe(3);
    });

    it("should handle clearing non-existent user gracefully", () => {
      useChatStore.getState().setUnreadCounts({ u1: 5 });
      useChatStore.getState().clearUnread("u999");

      expect(useChatStore.getState().unreadCounts).toEqual({ u1: 5 });
    });
  });

  describe("searchQuery", () => {
    it("should start with empty string", () => {
      expect(useChatStore.getState().searchQuery).toBe("");
    });

    it("should update search query", () => {
      useChatStore.getState().setSearchQuery("alice");
      expect(useChatStore.getState().searchQuery).toBe("alice");
    });
  });

  describe("theme", () => {
    it("should start with system theme mode", () => {
      expect(useChatStore.getState().themeMode).toBe("system");
      expect(useChatStore.getState().isDark).toBe(false);
    });

    it("should set theme mode", () => {
      useChatStore.getState().setThemeMode("dark");
      expect(useChatStore.getState().themeMode).toBe("dark");

      useChatStore.getState().setThemeMode("light");
      expect(useChatStore.getState().themeMode).toBe("light");

      useChatStore.getState().setThemeMode("system");
      expect(useChatStore.getState().themeMode).toBe("system");
    });

    it("should set isDark independently", () => {
      useChatStore.getState().setIsDark(true);
      expect(useChatStore.getState().isDark).toBe(true);

      useChatStore.getState().setIsDark(false);
      expect(useChatStore.getState().isDark).toBe(false);
    });
  });

  describe("sidebarOpen", () => {
    it("should start with sidebar open", () => {
      expect(useChatStore.getState().sidebarOpen).toBe(true);
    });

    it("should toggle sidebar state", () => {
      useChatStore.getState().setSidebarOpen(false);
      expect(useChatStore.getState().sidebarOpen).toBe(false);

      useChatStore.getState().setSidebarOpen(true);
      expect(useChatStore.getState().sidebarOpen).toBe(true);
    });
  });
});
