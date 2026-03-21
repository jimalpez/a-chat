import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  /** Get all users except the current user */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: { id: { not: ctx.session.user.id } },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
    return users;
  }),

  /** Search users by name or email */
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

  /** Get current user profile */
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { id: true, name: true, email: true, image: true },
    });
  }),
});
