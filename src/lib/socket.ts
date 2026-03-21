"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let socketConnected = false;

/**
 * Returns whether the socket is currently connected.
 * Use this to decide whether to use socket or tRPC fallback.
 */
export function isSocketConnected(): boolean {
  return socketConnected;
}

export function getSocket(): Socket | null {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    // If no socket URL configured, socket features are disabled
    if (!url) return null;

    socket = io(url, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      socketConnected = true;
      console.log("[Socket] Connected");
    });

    socket.on("disconnect", () => {
      socketConnected = false;
      console.log("[Socket] Disconnected");
    });

    socket.on("connect_error", (err) => {
      socketConnected = false;
      console.warn("[Socket] Connection error:", err.message);
    });
  }
  return socket;
}

export function connectSocket(userId: string): Socket | null {
  const s = getSocket();
  if (!s) return null;
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
  socketConnected = false;
  socket = null;
}

// Event type definitions
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
