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
        // Optimistic update — show message immediately before server echo
        const tempId = `temp-${Date.now()}`;
        addMessage({
          id: tempId,
          content,
          senderId: currentUserId,
          receiverId: selectedUser.id,
          createdAt: new Date().toISOString(),
          read: false,
          sender: {
            id: currentUserId,
            name: "",
            image: null,
          },
        });
        socket!.emit("send-message", {
          receiverId: selectedUser.id,
          content,
          senderId: currentUserId,
          tempId, // pass tempId so we can replace optimistic message
        });
      } else {
        // Fallback: send via tRPC (always works, even without socket)
        // Optimistic update — show message immediately before server responds
        const tempId = `temp-${Date.now()}`;
        addMessage({
          id: tempId,
          content,
          senderId: currentUserId,
          receiverId: selectedUser.id,
          createdAt: new Date().toISOString(),
          read: false,
          sender: {
            id: currentUserId,
            name: "",
            image: null,
          },
        });
        const message = await sendMutation.mutateAsync({
          receiverId: selectedUser.id,
          content,
        });
        // Replace optimistic message with the real one from server
        useChatStore.getState().replaceOptimisticMessage(tempId, {
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
    <div className="sticky bottom-0 z-10 border-t border-gray-200/80 bg-white/80 px-4 py-3 glass sm:px-5 sm:py-3.5 dark:border-gray-700/50 dark:bg-gray-900/80">
      <div className="flex items-end gap-2.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="min-h-[44px] flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 shadow-sm outline-none transition-shadow focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-500"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!text.trim() || sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25 transition-all active:scale-95 hover:shadow-lg hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
