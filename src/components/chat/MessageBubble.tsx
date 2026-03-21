"use client";

import type { ChatMessage } from "@/lib/store";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1`}>
      <div
        className={`flex max-w-[85%] items-end gap-1.5 sm:max-w-[70%] ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar for received messages */}
        {!isOwn && (
          <div className="h-7 w-7 shrink-0">
            {showAvatar && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-300 text-[10px] font-semibold text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                {message.sender.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0">
          {/* Message bubble */}
          <div
            className={`rounded-2xl px-3.5 py-2 ${
              isOwn
                ? "rounded-br-md bg-blue-500 text-white"
                : "rounded-bl-md bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white"
            }`}
          >
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {message.content}
            </p>
          </div>

          {/* Timestamp + read receipt */}
          <div
            className={`mt-0.5 flex items-center gap-1 px-1 ${
              isOwn ? "justify-end" : "justify-start"
            }`}
          >
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {formatTime(message.createdAt)}
            </span>
            {isOwn && message.read && (
              <svg
                className="h-3 w-3 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
