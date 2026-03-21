import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb, createMockCtx, type MockDb } from "./helpers";

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password_123"),
    compare: vi.fn(),
  },
}));

// We test the router logic directly by calling the procedure handlers
// through the tRPC caller pattern, but since that requires full setup,
// we'll test the business logic by importing and calling procedures directly.

import { authRouter } from "@/server/api/routers/auth";

describe("Auth Router", () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("should create a new user with hashed password", async () => {
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({
        id: "new-user-id",
        name: "Alice",
        email: "alice@test.com",
        password: "hashed_password_123",
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const caller = authRouter.createCaller({
        db: db as never,
        session: null,
        headers: new Headers(),
      });

      const result = await caller.register({
        name: "Alice",
        email: "alice@test.com",
        password: "password123",
      });

      expect(result).toEqual({
        id: "new-user-id",
        name: "Alice",
        email: "alice@test.com",
      });
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: "alice@test.com" },
      });
      expect(db.user.create).toHaveBeenCalledWith({
        data: {
          name: "Alice",
          email: "alice@test.com",
          password: "hashed_password_123",
          image: null,
        },
      });
    });

    it("should reject registration if email already exists", async () => {
      db.user.findUnique.mockResolvedValue({
        id: "existing-user",
        email: "alice@test.com",
      });

      const caller = authRouter.createCaller({
        db: db as never,
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          name: "Alice",
          email: "alice@test.com",
          password: "password123",
        }),
      ).rejects.toThrow("A user with this email already exists");

      expect(db.user.create).not.toHaveBeenCalled();
    });

    it("should reject name shorter than 2 characters", async () => {
      const caller = authRouter.createCaller({
        db: db as never,
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          name: "A",
          email: "a@test.com",
          password: "password123",
        }),
      ).rejects.toThrow();
    });

    it("should reject invalid email format", async () => {
      const caller = authRouter.createCaller({
        db: db as never,
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          name: "Alice",
          email: "not-an-email",
          password: "password123",
        }),
      ).rejects.toThrow();
    });

    it("should reject password shorter than 6 characters", async () => {
      const caller = authRouter.createCaller({
        db: db as never,
        session: null,
        headers: new Headers(),
      });

      await expect(
        caller.register({
          name: "Alice",
          email: "alice@test.com",
          password: "12345",
        }),
      ).rejects.toThrow();
    });
  });
});
