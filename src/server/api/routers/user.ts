import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { id: { not: ctx.session.user.id } },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
      orderBy: { name: "asc" },
    });
  }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!input.query.trim()) {
        return ctx.db.user.findMany({
          where: { id: { not: ctx.session.user.id } },
          select: { id: true, name: true, email: true, image: true },
          orderBy: { name: "asc" },
        });
      }
      return ctx.db.user.findMany({
        where: {
          AND: [
            { id: { not: ctx.session.user.id } },
            {
              OR: [
                { name: { contains: input.query, mode: "insensitive" } },
                { email: { contains: input.query, mode: "insensitive" } },
              ],
            },
          ],
        },
        select: { id: true, name: true, email: true, image: true },
        orderBy: { name: "asc" },
      });
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, name: true, email: true, image: true },
    });
  }),

  /** Get last seen timestamp for a user */
  getLastSeen: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { lastSeenAt: true, status: true },
      });
      return user;
    }),

  // ─── E2EE Key Management ────────────────────────────────

  publishPublicKey: protectedProcedure
    .input(z.object({ publicKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.userKeyPair.upsert({
        where: { userId: ctx.session.user.id },
        create: { userId: ctx.session.user.id, publicKey: input.publicKey },
        update: { publicKey: input.publicKey },
      });
    }),

  getPublicKey: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const kp = await ctx.db.userKeyPair.findUnique({
        where: { userId: input.userId },
      });
      return kp?.publicKey ?? null;
    }),

  hasKeyPair: protectedProcedure.query(async ({ ctx }) => {
    const kp = await ctx.db.userKeyPair.findUnique({
      where: { userId: ctx.session.user.id },
    });
    return !!kp;
  }),
});
