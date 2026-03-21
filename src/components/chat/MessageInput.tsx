"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket, isSocketConnected } from "@/lib/socket";
import { useChatStore } from "@/lib/store";
import { api } from "@/trpc/react";

interface MessageInputProps {
  currentUserId: string;
}

export function MessageInput({ currentUserId }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUser = useChatStore((s) => s.selectedUser);
  const addMessage = useChatStore((s) => s.addMessage);

  // tRPC mutation as the reliable send mechanism
  const sendMutation = api.message.send.useMutation();

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (!selectedUser) return;
      const socket = getSocket();
      if (socket && isSocketConnected()) {
        socket.emit("typing", {
          receiverId: selectedUser.id,
          isTyping,
        });
      }
    },
    [selectedUser],
  );

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    autoResize();

    sendTypingIndicator(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 1500);
  };

  const handleSend = async () => {
    if (!text.trim() || !selectedUser || sending) return;

    const content = text.trim();
    setSending(true);

    sendTypingIndicator(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      if (isSocketConnected()) {
        // If socket is connected, send via socket (server persists + broadcasts)
        const socket = getSocket();
        socket!.emit("send-message", {
          receiverId: selectedUser.id,
          content,
          senderId: currentUserId,
        });
      } else {
        // Fallback: send via tRPC (always works, even without socket)
        const message = await sendMutation.mutateAsync({
          receiverId: selectedUser.id,
          content,
        });
        // Add to local messages immediately
        addMessage({
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          receiverId: message.receiverId,
          createdAt:
            message.createdAt instanceof Date
              ? message.createdAt.toISOString()
              : String(message.createdAt),
          read: false,
          sender: message.sender,
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Restore the text so user doesn't lose their message
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const isMobile = window.innerWidth < 768;
      if (!isMobile) {
        e.preventDefault();
        void handleSend();
      }
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-3 py-2.5 safe-bottom sm:px-4 sm:py-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="min-h-[44px] flex-1 resize-none rounded-2xl bg-gray-100 px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!text.trim() || sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-colors active:bg-blue-700 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
