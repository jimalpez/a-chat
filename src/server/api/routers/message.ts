import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";

const messageInclude = {
  sender: { select: { id: true, name: true, image: true } },
  receiver: { select: { id: true, name: true, image: true } },
  reactions: {
    select: { id: true, emoji: true, userId: true, messageId: true },
  },
} as const;

export const messageRouter = createTRPCRouter({
  /** Paginated conversation — cursor loads older messages */
  getConversation: protectedProcedure
    .input(
      z.object({
        otherUserId: z.string(),
        cursor: z.string().nullish(),
        limit: z.number().min(1).max(100).default(30),
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
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
        include: messageInclude,
      });

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const oldest = messages.pop()!;
        nextCursor = oldest.id;
      }

      return {
        messages: messages.reverse(),
        nextCursor,
      };
    }),

  send: protectedProcedure
    .input(
      z.object({
        receiverId: z.string(),
        content: z.string().min(1).max(5000),
        encrypted: z.boolean().optional(),
        nonce: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.create({
        data: {
          content: input.content,
          senderId: ctx.session.user.id,
          receiverId: input.receiverId,
          encrypted: input.encrypted ?? false,
          nonce: input.nonce,
        },
        include: messageInclude,
      });

      return message;
    }),

  edit: protectedProcedure
    .input(z.object({ messageId: z.string(), content: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
      });
      if (message?.senderId !== ctx.session.user.id) {
        throw new Error("Not authorized to edit this message");
      }
      return ctx.db.message.update({
        where: { id: input.messageId },
        data: { content: input.content },
        include: messageInclude,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
      });
      if (message?.senderId !== ctx.session.user.id) {
        throw new Error("Not authorized to delete this message");
      }
      await ctx.db.message.delete({ where: { id: input.messageId } });
      return { success: true };
    }),

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

  addReaction: protectedProcedure
    .input(z.object({ messageId: z.string(), emoji: z.string().min(1).max(4) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.reaction.upsert({
        where: {
          messageId_userId_emoji: {
            messageId: input.messageId,
            userId: ctx.session.user.id,
            emoji: input.emoji,
          },
        },
        create: {
          messageId: input.messageId,
          userId: ctx.session.user.id,
          emoji: input.emoji,
        },
        update: {},
        select: { id: true, emoji: true, userId: true, messageId: true },
      });
    }),

  removeReaction: protectedProcedure
    .input(z.object({ reactionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reaction = await ctx.db.reaction.findUnique({
        where: { id: input.reactionId },
      });
      if (reaction?.userId !== ctx.session.user.id) {
        throw new Error("Not authorized");
      }
      await ctx.db.reaction.delete({ where: { id: input.reactionId } });
      return { success: true };
    }),

  getUnreadCounts: protectedProcedure.query(async ({ ctx }) => {
    const counts = await ctx.db.message.groupBy({
      by: ["senderId"],
      where: { receiverId: ctx.session.user.id, read: false },
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

  /** Search messages within a conversation */
  searchMessages: protectedProcedure
    .input(z.object({
      otherUserId: z.string(),
      query: z.string().min(1).max(200),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.message.findMany({
        where: {
          OR: [
            { senderId: ctx.session.user.id, receiverId: input.otherUserId },
            { senderId: input.otherUserId, receiverId: ctx.session.user.id },
          ],
          content: { contains: input.query, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: messageInclude,
      });
    }),

  /** Mute/unmute a conversation */
  muteConversation: protectedProcedure
    .input(z.object({
      targetId: z.string(),
      muted: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.muted) {
        await ctx.db.mutedConversation.upsert({
          where: {
            userId_targetId: {
              userId: ctx.session.user.id,
              targetId: input.targetId,
            },
          },
          create: {
            userId: ctx.session.user.id,
            targetId: input.targetId,
          },
          update: {},
        });
      } else {
        await ctx.db.mutedConversation.deleteMany({
          where: {
            userId: ctx.session.user.id,
            targetId: input.targetId,
          },
        });
      }
      return { success: true };
    }),

  /** Check if a conversation is muted */
  isMuted: protectedProcedure
    .input(z.object({ targetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const muted = await ctx.db.mutedConversation.findUnique({
        where: {
          userId_targetId: {
            userId: ctx.session.user.id,
            targetId: input.targetId,
          },
        },
      });
      return !!muted;
    }),

  getConversationPreviews: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
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
    const previews = await Promise.all(
      partnerIds.map((partnerId) =>
        ctx.db.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: partnerId },
              { senderId: partnerId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: messageInclude,
        }),
      ),
    );
    return previews
      .filter(Boolean)
      .sort((a, b) => new Date(b!.createdAt).getTime() - new Date(a!.createdAt).getTime());
  }),
});
