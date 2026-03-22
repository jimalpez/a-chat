import { vi } from "vitest";

/**
 * Creates a mock Prisma client with chainable methods.
 * Each model method returns vi.fn() that can be configured per test.
 */
export function createMockDb() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
  };
}

export type MockDb = ReturnType<typeof createMockDb>;

/** Creates a mock authenticated session */
export function createMockSession(userId = "user-1", name = "Test User") {
  return {
    user: {
      id: userId,
      name,
      email: `${name.toLowerCase().replace(" ", ".")}@test.com`,
      image: null,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

/** Creates a mock tRPC context for testing */
export function createMockCtx(
  db: MockDb,
  session: ReturnType<typeof createMockSession> | null = null,
) {
  return {
    db: db as unknown as Parameters<never>[0],
    session,
    headers: new Headers(),
  };
}
