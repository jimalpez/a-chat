"use client";

import { io, type Socket } from "socket.io-client";

// Socket.io client singleton
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url =
      process.env.NEXT_PUBLIC_SOCKET_URL ?? window.location.origin;
    socket = io(url, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function connectSocket(userId: string): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { userId };
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
  socket = null;
}

// Event type definitions for type safety
export interface ServerToClientEvents {
  "receive-message": (message: {
    id: string;
    content: string;
    senderId: string;
    receiverId: string;
    createdAt: string;
    sender: { id: string; name: string; image: string | null };
  }) => void;
  "user-online": (userId: string) => void;
  "user-offline": (userId: string) => void;
  "online-users": (userIds: string[]) => void;
  "user-typing": (data: { userId: string; isTyping: boolean }) => void;
  "message-read": (data: { readerId: string; senderId: string }) => void;
}

export interface ClientToServerEvents {
  "send-message": (data: {
    receiverId: string;
    content: string;
    senderId: string;
  }) => void;
  "join": (userId: string) => void;
  "typing": (data: { receiverId: string; isTyping: boolean }) => void;
  "mark-read": (data: { senderId: string }) => void;
}
