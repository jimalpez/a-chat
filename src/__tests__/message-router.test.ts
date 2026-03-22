import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb, createMockSession, type MockDb } from "./helpers";
import { messageRouter } from "@/server/api/routers/message";

describe("Message Router", () => {
  let db: MockDb;
  const session = createMockSession("user-1", "Test User");

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  function createCaller() {
    return messageRouter.createCaller({
      db: db as never,
      session,
      headers: new Headers(),
    });
  }

  describe("getConversation", () => {
    it("should fetch messages between two users", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          content: "Hello",
          senderId: "user-1",
          receiverId: "user-2",
          createdAt: new Date(),
          read: true,
          sender: { id: "user-1", name: "Test User", image: null },
          receiver: { id: "user-2", name: "Bob", image: null },
        },
        {
          id: "msg-2",
          content: "Hi there!",
          senderId: "user-2",
          receiverId: "user-1",
          createdAt: new Date(),
          read: false,
          sender: { id: "user-2", name: "Bob", image: null },
          receiver: { id: "user-1", name: "Test User", image: null },
        },
      ];
      db.message.findMany.mockResolvedValue(mockMessages);

      const caller = createCaller();
      const result = await caller.getConversation({ otherUserId: "user-2" });

      expect(result.messages).toEqual(mockMessages);
      expect(result.nextCursor).toBeUndefined();
      expect(db.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { senderId: "user-1", receiverId: "user-2" },
              { senderId: "user-2", receiverId: "user-1" },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 31,
        }),
      );
    });

    it("should support custom limit", async () => {
      db.message.findMany.mockResolvedValue([]);

      const caller = createCaller();
      await caller.getConversation({ otherUserId: "user-2", limit: 10 });

      expect(db.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 11 }),
      );
    });

    it("should support cursor-based pagination", async () => {
      db.message.findMany.mockResolvedValue([]);

      const caller = createCaller();
      await caller.getConversation({
        otherUserId: "user-2",
        cursor: "msg-5",
      });

      expect(db.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "msg-5" },
          skip: 1,
        }),
      );
    });

    it("should return empty array for no messages", async () => {
      db.message.findMany.mockResolvedValue([]);

      const caller = createCaller();
      const result = await caller.getConversation({ otherUserId: "user-2" });

      expect(result.messages).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe("send", () => {
    it("should create a message and return it with sender/receiver info", async () => {
      const mockMessage = {
        id: "msg-new",
        content: "Hello Bob!",
        senderId: "user-1",
        receiverId: "user-2",
        createdAt: new Date(),
        read: false,
        sender: { id: "user-1", name: "Test User", image: null },
        receiver: { id: "user-2", name: "Bob", image: null },
      };
      db.message.create.mockResolvedValue(mockMessage);

      const caller = createCaller();
      const result = await caller.send({
        receiverId: "user-2",
        content: "Hello Bob!",
      });

      expect(result).toEqual(mockMessage);
      expect(db.message.create).toHaveBeenCalledWith({
        data: {
          content: "Hello Bob!",
          senderId: "user-1",
          receiverId: "user-2",
          encrypted: false,
          nonce: undefined,
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          receiver: { select: { id: true, name: true, image: true } },
          reactions: {
            select: { id: true, emoji: true, userId: true, messageId: true },
          },
        },
      });
    });

    it("should reject empty messages", async () => {
      const caller = createCaller();

      await expect(
        caller.send({ receiverId: "user-2", content: "" }),
      ).rejects.toThrow();
    });

    it("should reject messages over 5000 characters", async () => {
      const caller = createCaller();

      await expect(
        caller.send({
          receiverId: "user-2",
          content: "a".repeat(5001),
        }),
      ).rejects.toThrow();
    });
  });

  describe("markAsRead", () => {
    it("should mark unread messages from a sender as read", async () => {
      db.message.updateMany.mockResolvedValue({ count: 3 });

      const caller = createCaller();
      const result = await caller.markAsRead({ senderId: "user-2" });

      expect(result).toEqual({ success: true });
      expect(db.message.updateMany).toHaveBeenCalledWith({
        where: {
          senderId: "user-2",
          receiverId: "user-1",
          read: false,
        },
        data: { read: true },
      });
    });

    it("should succeed even when no unread messages exist", async () => {
      db.message.updateMany.mockResolvedValue({ count: 0 });

      const caller = createCaller();
      const result = await caller.markAsRead({ senderId: "user-2" });

      expect(result).toEqual({ success: true });
    });
  });

  describe("getUnreadCounts", () => {
    it("should return unread counts grouped by sender", async () => {
      db.message.groupBy.mockResolvedValue([
        { senderId: "user-2", _count: { id: 3 } },
        { senderId: "user-3", _count: { id: 1 } },
      ]);

      const caller = createCaller();
      const result = await caller.getUnreadCounts();

      expect(result).toEqual({
        "user-2": 3,
        "user-3": 1,
      });
    });

    it("should return empty object when no unread messages", async () => {
      db.message.groupBy.mockResolvedValue([]);

      const caller = createCaller();
      const result = await caller.getUnreadCounts();

      expect(result).toEqual({});
    });
  });

  describe("getConversationPreviews", () => {
    it("should return last message from each conversation", async () => {
      // Mock distinct partners
      db.message.findMany
        .mockResolvedValueOnce([{ receiverId: "user-2" }]) // sentTo
        .mockResolvedValueOnce([{ senderId: "user-3" }]); // receivedFrom

      const msg1 = {
        id: "msg-10",
        content: "Latest to user-2",
        senderId: "user-1",
        receiverId: "user-2",
        createdAt: new Date("2024-01-02"),
        sender: { id: "user-1", name: "Test", image: null },
        receiver: { id: "user-2", name: "Bob", image: null },
      };
      const msg2 = {
        id: "msg-11",
        content: "Latest from user-3",
        senderId: "user-3",
        receiverId: "user-1",
        createdAt: new Date("2024-01-01"),
        sender: { id: "user-3", name: "Charlie", image: null },
        receiver: { id: "user-1", name: "Test", image: null },
      };

      db.message.findFirst
        .mockResolvedValueOnce(msg1) // last msg with user-2
        .mockResolvedValueOnce(msg2); // last msg with user-3

      const caller = createCaller();
      const result = await caller.getConversationPreviews();

      // Should be sorted by most recent first
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe("msg-10"); // newer
      expect(result[1]!.id).toBe("msg-11"); // older
    });

    it("should return empty array when no conversations exist", async () => {
      db.message.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const caller = createCaller();
      const result = await caller.getConversationPreviews();

      expect(result).toEqual([]);
    });
  });

  describe("authentication", () => {
    it("should reject unauthenticated requests", async () => {
      const caller = messageRouter.createCaller({
        db: db as never,
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.getConversation({ otherUserId: "user-2" }),
      ).rejects.toThrow("UNAUTHORIZED");
      await expect(
        caller.send({ receiverId: "user-2", content: "hi" }),
      ).rejects.toThrow("UNAUTHORIZED");
      await expect(
        caller.markAsRead({ senderId: "user-2" }),
      ).rejects.toThrow("UNAUTHORIZED");
      await expect(caller.getUnreadCounts()).rejects.toThrow("UNAUTHORIZED");
      await expect(caller.getConversationPreviews()).rejects.toThrow("UNAUTHORIZED");
    });
  });
});
