import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { PrismaClient } from "./generated/prisma/index.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const db = new PrismaClient();

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map<string, Set<string>>();

function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res).catch(console.error);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : undefined,
      methods: ["GET", "POST"],
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

    // Track this socket for the user
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Notify everyone this user is online
    io.emit("user-online", userId);

    // Send the full list of online users to the newly connected client
    socket.emit("online-users", getOnlineUserIds());

    // Handle incoming messages
    socket.on("send-message", async (data: { receiverId: string; content: string; senderId: string }) => {
      try {
        // Persist message to database
        const message = await db.message.create({
          data: {
            content: data.content,
            senderId: data.senderId,
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

        // Send to the receiver's sockets
        const receiverSockets = onlineUsers.get(data.receiverId);
        if (receiverSockets) {
          receiverSockets.forEach((socketId) => {
            io.to(socketId).emit("receive-message", payload);
          });
        }

        // Also send back to sender's sockets (for multi-tab support)
        const senderSockets = onlineUsers.get(data.senderId);
        if (senderSockets) {
          senderSockets.forEach((socketId) => {
            io.to(socketId).emit("receive-message", payload);
          });
        }
      } catch (err) {
        console.error("[Socket] Error saving message:", err);
      }
    });

    // Handle typing indicators
    socket.on("typing", (data: { receiverId: string; isTyping: boolean }) => {
      const receiverSockets = onlineUsers.get(data.receiverId);
      if (receiverSockets) {
        receiverSockets.forEach((socketId) => {
          io.to(socketId).emit("user-typing", {
            userId,
            isTyping: data.isTyping,
          });
        });
      }
    });

    // Handle mark-as-read
    socket.on("mark-read", async (data: { senderId: string }) => {
      try {
        await db.message.updateMany({
          where: {
            senderId: data.senderId,
            receiverId: userId,
            read: false,
          },
          data: { read: true },
        });

        // Notify the sender that their messages were read
        const senderSockets = onlineUsers.get(data.senderId);
        if (senderSockets) {
          senderSockets.forEach((socketId) => {
            io.to(socketId).emit("message-read", {
              readerId: userId,
              senderId: data.senderId,
            });
          });
        }
      } catch (err) {
        console.error("[Socket] Error marking messages as read:", err);
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`[Socket] User disconnected: ${userId} (${socket.id})`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Only emit offline if user has no more connected sockets
          io.emit("user-offline", userId);
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
