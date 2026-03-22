import { authRouter } from "@/server/api/routers/auth";
import { messageRouter } from "@/server/api/routers/message";
import { userRouter } from "@/server/api/routers/user";
import { groupRouter } from "@/server/api/routers/group";
import { notificationRouter } from "@/server/api/routers/notification";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  message: messageRouter,
  group: groupRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
