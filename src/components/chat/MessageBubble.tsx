"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore, type ChatMessage } from "@/lib/store";
import { api } from "@/trpc/react";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Single checkmark — sent/delivered */
function SingleCheck({ className }: { className?: string }) {
  return (
    <svg className={`h-3.5 w-3.5 ${className}`} viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8.5l3.5 3.5L13 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Double checkmark — seen/read */
function DoubleCheck({ className }: { className?: string }) {
  return (
    <svg className={`h-3.5 w-3.5 ${className}`} viewBox="0 0 20 16" fill="none">
      <path
        d="M1.5 8.5L5 12l7.5-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 8.5L10 12l7.5-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Clock icon — sending/optimistic */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={`h-3 w-3 ${className}`} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
  const isOptimistic = message.id.startsWith("temp-");
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const deleteMutation = api.message.delete.useMutation();

  const handleDelete = useCallback(async () => {
    if (isOptimistic || deleting) return;
    setDeleting(true);
    setShowMenu(false);
    // Optimistic remove
    removeMessage(message.id);
    try {
      await deleteMutation.mutateAsync({ messageId: message.id });
    } catch {
      // If delete fails, message will reappear on next fetch
    }
  }, [message.id, isOptimistic, deleting, removeMessage, deleteMutation]);

  const handleTouchStart = useCallback(() => {
    if (!isOwn || isOptimistic) return;
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true);
    }, 500);
  }, [isOwn, isOptimistic]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`group relative flex max-w-[85%] items-end gap-2 sm:max-w-[70%] ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Avatar for received messages */}
        {!isOwn && (
          <div className="h-7 w-7 shrink-0">
            {showAvatar && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-[10px] font-bold text-white dark:from-gray-500 dark:to-gray-600">
                {message.sender.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <div className="relative min-w-0">
          {/* Delete button — hover on desktop */}
          {isOwn && !isOptimistic && (
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="absolute -left-8 top-1/2 hidden -translate-y-1/2 rounded-full p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100 sm:block dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
          )}

          {/* Delete confirmation dropdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div
                className={`absolute z-50 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
                  isOwn ? "right-0 top-full mt-1" : "left-0 top-full mt-1"
                }`}
              >
                <button
                  onClick={() => void handleDelete()}
                  className="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete message
                </button>
              </div>
            </>
          )}

          {/* Message bubble */}
          <div
            className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
              isOwn
                ? "rounded-br-md bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                : "rounded-bl-md bg-white text-gray-800 ring-1 ring-gray-100 dark:bg-gray-700/80 dark:text-gray-100 dark:ring-gray-600/30"
            } ${isOptimistic ? "opacity-70" : ""}`}
          >
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {message.content}
            </p>
          </div>

          {/* Timestamp + status indicator */}
          <div
            className={`mt-0.5 flex items-center gap-1 px-1 ${
              isOwn ? "justify-end" : "justify-start"
            }`}
          >
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {formatTime(message.createdAt)}
            </span>
            {isOwn && (
              isOptimistic ? (
                <ClockIcon className="text-gray-400 dark:text-gray-500" />
              ) : message.read ? (
                <DoubleCheck className="text-blue-400" />
              ) : (
                <SingleCheck className="text-gray-400 dark:text-gray-500" />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
