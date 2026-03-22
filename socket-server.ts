import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { PrismaClient } from "./generated/prisma/index.js";

const port = parseInt(process.env.PORT ?? process.env.SOCKET_PORT ?? "3001", 10);
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:3000"];

const db = new PrismaClient();

const onlineUsers = new Map<string, Set<string>>();

function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}

const httpServer = createServer((_req, res) => {
  // Health check endpoint for Railway/Render
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", connections: onlineUsers.size }));
});

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  const userId = socket.handshake.auth.userId as string | undefined;

  if (!userId) {
    socket.disconnect();
    return;
  }

  console.log(`[Socket] User connected: ${userId} (${socket.id})`);

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId)!.add(socket.id);

  io.emit("user-online", userId);
  socket.emit("online-users", getOnlineUserIds());

  socket.on("send-message", async (data: { receiverId: string; content: string; senderId: string; tempId?: string }) => {
    // Validate senderId matches the authenticated socket user to prevent spoofing
    if (data.senderId !== userId) {
      console.error(`[Socket] Spoofing attempt: socket user ${userId} tried to send as ${data.senderId}`);
      return;
    }
    if (!data.content || !data.receiverId) return;

    try {
      const message = await db.message.create({
        data: {
          content: data.content,
          senderId: userId,
          receiverId: data.receiverId,
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          receiver: { select: { id: true, name: true, image: true } },
        },
      });

      const payload = {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        receiverId: message.receiverId,
        createdAt: message.createdAt.toISOString(),
        sender: message.sender,
      };

      const receiverSockets = onlineUsers.get(data.receiverId);
      if (receiverSockets) {
        receiverSockets.forEach((sid) => io.to(sid).emit("receive-message", payload));
      }

      // Echo back to sender with tempId so the optimistic message can be replaced
      const senderPayload = { ...payload, tempId: data.tempId };
      const senderSockets = onlineUsers.get(data.senderId);
      if (senderSockets) {
        senderSockets.forEach((sid) => io.to(sid).emit("receive-message", senderPayload));
      }
    } catch (err) {
      console.error("[Socket] Error saving message:", err);
    }
  });

  socket.on("typing", (data: { receiverId: string; isTyping: boolean }) => {
    const receiverSockets = onlineUsers.get(data.receiverId);
    if (receiverSockets) {
      receiverSockets.forEach((sid) => {
        io.to(sid).emit("user-typing", { userId, isTyping: data.isTyping });
      });
    }
  });

  socket.on("mark-read", async (data: { senderId: string }) => {
    try {
      await db.message.updateMany({
        where: { senderId: data.senderId, receiverId: userId, read: false },
        data: { read: true },
      });

      const senderSockets = onlineUsers.get(data.senderId);
      if (senderSockets) {
        senderSockets.forEach((sid) => {
          io.to(sid).emit("message-read", { readerId: userId, senderId: data.senderId });
        });
      }
    } catch (err) {
      console.error("[Socket] Error marking messages as read:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] User disconnected: ${userId} (${socket.id})`);
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit("user-offline", userId);
      }
    }
  });
});

httpServer.listen(port, () => {
  console.log(`[Socket.io] Server running on port ${port}`);
  console.log(`[Socket.io] Allowed origins: ${allowedOrigins.join(", ")}`);
});
