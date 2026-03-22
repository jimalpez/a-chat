import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

const groupMessageInclude = {
  sender: { select: { id: true, name: true, image: true } },
  reactions: {
    select: { id: true, emoji: true, userId: true, messageId: true },
  },
} as const;

export const groupRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      memberIds: z.array(z.string()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.group.create({
        data: {
          name: input.name,
          createdById: ctx.session.user.id,
          members: {
            create: [
              { userId: ctx.session.user.id, role: "admin" },
              ...input.memberIds.map((id) => ({ userId: id, role: "member" as const })),
            ],
          },
        },
        include: {
          members: { include: { user: { select: { id: true, name: true, image: true } } } },
        },
      });
      return group;
    }),

  getMyGroups: protectedProcedure.query(async ({ ctx }) => {
    const groups = await ctx.db.group.findMany({
      where: { members: { some: { userId: ctx.session.user.id } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, image: true } } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate unread counts
    return Promise.all(
      groups.map(async (group) => {
        const membership = group.members.find((m) => m.userId === ctx.session.user.id);
        const unreadCount = membership
          ? await ctx.db.groupMessage.count({
              where: {
                groupId: group.id,
                createdAt: { gt: membership.lastReadAt },
                senderId: { not: ctx.session.user.id },
              },
            })
          : 0;

        return {
          id: group.id,
          name: group.name,
          image: group.image,
          memberCount: group.members.length,
          members: group.members.map((m) => m.user),
          lastMessage: group.messages[0] ?? null,
          unreadCount,
        };
      }),
    );
  }),

  getMessages: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      cursor: z.string().nullish(),
      limit: z.number().min(1).max(100).default(30),
    }))
    .query(async ({ ctx, input }) => {
      // Verify membership
      const member = await ctx.db.groupMember.findUnique({
        where: { userId_groupId: { userId: ctx.session.user.id, groupId: input.groupId } },
      });
      if (!member) throw new Error("Not a member of this group");

      const messages = await ctx.db.groupMessage.findMany({
        where: { groupId: input.groupId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: groupMessageInclude,
      });

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const oldest = messages.pop()!;
        nextCursor = oldest.id;
      }

      return { messages: messages.reverse(), nextCursor };
    }),

  sendMessage: protectedProcedure
    .input(z.object({ groupId: z.string(), content: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.groupMember.findUnique({
        where: { userId_groupId: { userId: ctx.session.user.id, groupId: input.groupId } },
      });
      if (!member) throw new Error("Not a member of this group");

      const [message] = await ctx.db.$transaction([
        ctx.db.groupMessage.create({
          data: {
            content: input.content,
            senderId: ctx.session.user.id,
            groupId: input.groupId,
          },
          include: groupMessageInclude,
        }),
        ctx.db.group.update({
          where: { id: input.groupId },
          data: { updatedAt: new Date() },
        }),
      ]);

      return message;
    }),

  markRead: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.groupMember.update({
        where: { userId_groupId: { userId: ctx.session.user.id, groupId: input.groupId } },
        data: { lastReadAt: new Date() },
      });
      return { success: true };
    }),

  addMember: protectedProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const admin = await ctx.db.groupMember.findUnique({
        where: { userId_groupId: { userId: ctx.session.user.id, groupId: input.groupId } },
      });
      if (admin?.role !== "admin") throw new Error("Only admins can add members");

      return ctx.db.groupMember.create({
        data: { userId: input.userId, groupId: input.groupId },
        include: { user: { select: { id: true, name: true, image: true } } },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const requester = await ctx.db.groupMember.findUnique({
        where: { userId_groupId: { userId: ctx.session.user.id, groupId: input.groupId } },
      });
      // Can remove self, or admin can remove others
      if (input.userId !== ctx.session.user.id && requester?.role !== "admin") {
        throw new Error("Not authorized");
      }
      await ctx.db.groupMember.delete({
        where: { userId_groupId: { userId: input.userId, groupId: input.groupId } },
      });
      return { success: true };
    }),

  getMembers: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.groupMember.findMany({
        where: { groupId: input.groupId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { joinedAt: "asc" },
      });
    }),
});
