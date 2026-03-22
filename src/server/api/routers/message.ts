import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";

export const messageRouter = createTRPCRouter({
  /** Get conversation messages between current user and another user */
  getConversation: protectedProcedure
    .input(
      z.object({
        otherUserId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.message.findMany({
        where: {
          OR: [
            { senderId: ctx.session.user.id, receiverId: input.otherUserId },
            { senderId: input.otherUserId, receiverId: ctx.session.user.id },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: input.limit,
        ...(input.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
        include: {
          sender: { select: { id: true, name: true, image: true } },
          receiver: { select: { id: true, name: true, image: true } },
        },
      });

      return messages;
    }),

  /** Send a message to another user */
  send: protectedProcedure
    .input(
      z.object({
        receiverId: z.string(),
        content: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.create({
        data: {
          content: input.content,
          senderId: ctx.session.user.id,
          receiverId: input.receiverId,
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          receiver: { select: { id: true, name: true, image: true } },
        },
      });

      return message;
    }),

  /** Delete a message (only the sender can delete) */
  delete: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
      });

      if (message?.senderId !== ctx.session.user.id) {
        throw new Error("Not authorized to delete this message");
      }

      await ctx.db.message.delete({
        where: { id: input.messageId },
      });

      return { success: true };
    }),

  /** Mark messages from a specific user as read */
  markAsRead: protectedProcedure
    .input(z.object({ senderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.message.updateMany({
        where: {
          senderId: input.senderId,
          receiverId: ctx.session.user.id,
          read: false,
        },
        data: { read: true },
      });
      return { success: true };
    }),

  /** Get unread message counts grouped by sender */
  getUnreadCounts: protectedProcedure.query(async ({ ctx }) => {
    const counts = await ctx.db.message.groupBy({
      by: ["senderId"],
      where: {
        receiverId: ctx.session.user.id,
        read: false,
      },
      _count: { id: true },
    });

    return counts.reduce(
      (acc, item) => {
        acc[item.senderId] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );
  }),

  /** Get the last message for each conversation (for sidebar preview) */
  getConversationPreviews: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get distinct conversation partners
    const sentTo = await ctx.db.message.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ["receiverId"],
    });
    const receivedFrom = await ctx.db.message.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ["senderId"],
    });

    const partnerIds = [
      ...new Set([
        ...sentTo.map((m) => m.receiverId),
        ...receivedFrom.map((m) => m.senderId),
      ]),
    ];

    // Get the last message for each conversation partner
    const previews = await Promise.all(
      partnerIds.map(async (partnerId) => {
        const lastMessage = await ctx.db.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: partnerId },
              { senderId: partnerId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: {
            sender: { select: { id: true, name: true, image: true } },
            receiver: { select: { id: true, name: true, image: true } },
          },
        });
        return lastMessage;
      }),
    );

    return previews
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime(),
      );
  }),
});
