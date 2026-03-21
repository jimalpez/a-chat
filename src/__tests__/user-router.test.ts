import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb, createMockSession, type MockDb } from "./helpers";
import { userRouter } from "@/server/api/routers/user";

describe("User Router", () => {
  let db: MockDb;
  const session = createMockSession("user-1", "Test User");

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  function createCaller() {
    return userRouter.createCaller({
      db: db as never,
      session,
      headers: new Headers(),
    });
  }

  describe("getAll", () => {
    it("should return all users except the current user", async () => {
      const mockUsers = [
        { id: "user-2", name: "Bob", email: "bob@test.com", image: null, createdAt: new Date() },
        { id: "user-3", name: "Charlie", email: "charlie@test.com", image: null, createdAt: new Date() },
      ];
      db.user.findMany.mockResolvedValue(mockUsers);

      const caller = createCaller();
      const result = await caller.getAll();

      expect(result).toEqual(mockUsers);
      expect(db.user.findMany).toHaveBeenCalledWith({
        where: { id: { not: "user-1" } },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      });
    });

    it("should return empty array when no other users exist", async () => {
      db.user.findMany.mockResolvedValue([]);

      const caller = createCaller();
      const result = await caller.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("search", () => {
    it("should return all users when query is empty", async () => {
      const mockUsers = [
        { id: "user-2", name: "Bob", email: "bob@test.com", image: null },
      ];
      db.user.findMany.mockResolvedValue(mockUsers);

      const caller = createCaller();
      const result = await caller.search({ query: "" });

      expect(result).toEqual(mockUsers);
      // Should use simple filter (no OR clause) for empty query
      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { not: "user-1" } },
        }),
      );
    });

    it("should filter users by name or email when query is provided", async () => {
      const mockUsers = [
        { id: "user-2", name: "Bob", email: "bob@test.com", image: null },
      ];
      db.user.findMany.mockResolvedValue(mockUsers);

      const caller = createCaller();
      const result = await caller.search({ query: "bob" });

      expect(result).toEqual(mockUsers);
      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { id: { not: "user-1" } },
              {
                OR: [
                  { name: { contains: "bob", mode: "insensitive" } },
                  { email: { contains: "bob", mode: "insensitive" } },
                ],
              },
            ],
          },
        }),
      );
    });

    it("should treat whitespace-only query as empty", async () => {
      db.user.findMany.mockResolvedValue([]);

      const caller = createCaller();
      await caller.search({ query: "   " });

      // Should use simple filter, not the AND/OR filter
      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { not: "user-1" } },
        }),
      );
    });
  });

  describe("me", () => {
    it("should return the current user profile", async () => {
      const mockUser = { id: "user-1", name: "Test User", email: "test@test.com", image: null };
      db.user.findUnique.mockResolvedValue(mockUser);

      const caller = createCaller();
      const result = await caller.me();

      expect(result).toEqual(mockUser);
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { id: true, name: true, email: true, image: true },
      });
    });

    it("should return null if user not found", async () => {
      db.user.findUnique.mockResolvedValue(null);

      const caller = createCaller();
      const result = await caller.me();

      expect(result).toBeNull();
    });
  });

  describe("authentication", () => {
    it("should reject unauthenticated requests", async () => {
      const caller = userRouter.createCaller({
        db: db as never,
        session: null,
        headers: new Headers(),
      });

      await expect(caller.getAll()).rejects.toThrow("UNAUTHORIZED");
      await expect(caller.search({ query: "test" })).rejects.toThrow("UNAUTHORIZED");
      await expect(caller.me()).rejects.toThrow("UNAUTHORIZED");
    });
  });
});
