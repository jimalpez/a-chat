import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * Context — available in all tRPC procedures.
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();
  return { db, session, ...opts };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/**
 * Timing middleware — logs procedure execution time.
 * No artificial delay in any environment.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);
  return result;
});

/**
 * Rate limiting middleware — prevents spam/abuse.
 * Limits: 60 requests per minute per user for mutations,
 * 120 requests per minute per user for queries.
 */
const rateLimitMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  const userId = ctx.session?.user?.id ?? "anon";
  const limit = type === "mutation" ? 60 : 120;
  const windowMs = 60_000; // 1 minute

  const { allowed, remaining } = checkRateLimit(
    `${userId}:${path}`,
    limit,
    windowMs,
  );

  if (!allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Try again in a moment. (${remaining} remaining)`,
    });
  }

  return next();
});

/**
 * Public procedure — no auth required, rate-limited.
 */
export const publicProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware);

/**
 * Protected procedure — requires auth, rate-limited.
 * Updates user lastSeenAt on each request.
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    // Update lastSeen timestamp (fire-and-forget, don't await)
    void ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { lastSeenAt: new Date(), status: "online" },
    }).catch(() => { /* ignore errors */ });

    return next({
      ctx: {
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });
