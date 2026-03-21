"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { useChatStore } from "@/lib/store";

interface MessageInputProps {
  currentUserId: string;
}

export function MessageInput({ currentUserId }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUser = useChatStore((s) => s.selectedUser);

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (!selectedUser) return;
      const socket = getSocket();
      socket.emit("typing", {
        receiverId: selectedUser.id,
        isTyping,
      });
    },
    [selectedUser],
  );

  // Auto-resize textarea as user types
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

  const handleSend = () => {
    if (!text.trim() || !selectedUser) return;

    const socket = getSocket();
    socket.emit("send-message", {
      receiverId: selectedUser.id,
      content: text.trim(),
      senderId: currentUserId,
    });

    sendTypingIndicator(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On mobile, Enter creates newline. On desktop, Enter sends.
    if (e.key === "Enter" && !e.shiftKey) {
      // Only prevent default (send) on desktop — mobile uses send button
      const isMobile = window.innerWidth < 768;
      if (!isMobile) {
        e.preventDefault();
        handleSend();
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
          onClick={handleSend}
          disabled={!text.trim()}
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
