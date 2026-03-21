import { vi } from "vitest";

// Mock next-auth — it imports next/server which doesn't exist outside Next.js
vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

vi.mock("@/server/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock the env module to avoid validation in tests
vi.mock("@/env", () => ({
  env: {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-secret",
  },
}));
