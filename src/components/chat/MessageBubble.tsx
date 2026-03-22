"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore, type ChatMessage } from "@/lib/store";
import { api } from "@/trpc/react";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  currentUserId: string;
  showSenderName?: boolean;
}

const QUICK_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SingleCheck({ className }: { className?: string }) {
  return (
    <svg className={`h-3.5 w-3.5 ${className}`} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DoubleCheck({ className }: { className?: string }) {
  return (
    <svg className={`h-3.5 w-3.5 ${className}`} viewBox="0 0 20 16" fill="none">
      <path d="M1.5 8.5L5 12l7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 8.5L10 12l7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={`h-3 w-3 ${className}`} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MessageBubble({ message, isOwn, showAvatar, currentUserId, showSenderName }: MessageBubbleProps) {
  const isOptimistic = message.id.startsWith("temp-");
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const updateMessageContent = useChatStore((s) => s.updateMessageContent);
  const addReaction = useChatStore((s) => s.addReaction);
  const removeReaction = useChatStore((s) => s.removeReaction);

  const utils = api.useUtils();
  const invalidateAll = () => {
    void utils.message.getConversation.invalidate();
    void utils.group.getMessages.invalidate();
  };
  const deleteMutation = api.message.delete.useMutation({ onSuccess: invalidateAll });
  const editMutation = api.message.edit.useMutation({ onSuccess: invalidateAll });
  const addReactionMutation = api.message.addReaction.useMutation({ onSuccess: invalidateAll });
  const removeReactionMutation = api.message.removeReaction.useMutation({ onSuccess: invalidateAll });

  const handleDelete = useCallback(async () => {
    if (isOptimistic) return;
    setShowMenu(false);
    removeMessage(message.id);
    try {
      await deleteMutation.mutateAsync({ messageId: message.id });
    } catch {
      // Will reappear on next fetch
    }
  }, [message.id, isOptimistic, removeMessage, deleteMutation]);

  const handleStartEdit = useCallback(() => {
    setShowMenu(false);
    setEditText(message.content);
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  }, [message.content]);

  const handleSaveEdit = useCallback(async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      return;
    }
    setEditing(false);
    updateMessageContent(message.id, trimmed);
    try {
      await editMutation.mutateAsync({ messageId: message.id, content: trimmed });
    } catch {
      updateMessageContent(message.id, message.content);
    }
  }, [editText, message.id, message.content, updateMessageContent, editMutation]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSaveEdit();
    }
    if (e.key === "Escape") {
      setEditing(false);
    }
  }, [handleSaveEdit]);

  const handleReact = useCallback(async (emoji: string) => {
    if (isOptimistic) return;
    setShowMenu(false);

    const existing = (message.reactions ?? []).find(
      (r) => r.emoji === emoji && r.userId === currentUserId,
    );

    if (existing) {
      removeReaction(message.id, existing.id);
      try {
        await removeReactionMutation.mutateAsync({ reactionId: existing.id });
      } catch { /* resync on next fetch */ }
    } else {
      const tempReaction = {
        id: `temp-${Date.now()}`,
        emoji,
        userId: currentUserId,
        messageId: message.id,
      };
      addReaction(message.id, tempReaction);
      try {
        const real = await addReactionMutation.mutateAsync({
          messageId: message.id,
          emoji,
        });
        removeReaction(message.id, tempReaction.id);
        addReaction(message.id, real);
      } catch {
        removeReaction(message.id, tempReaction.id);
      }
    }
  }, [message, isOptimistic, currentUserId, addReaction, removeReaction, addReactionMutation, removeReactionMutation]);

  const handleTouchStart = useCallback(() => {
    if (isOptimistic) return;
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true);
    }, 500);
  }, [isOptimistic]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Group reactions by emoji
  const reactions = message.reactions ?? [];
  const groupedReactions = reactions.reduce<Record<string, { count: number; userReacted: boolean; reactionId?: string }>>((acc, r) => {
    acc[r.emoji] ??= { count: 0, userReacted: false };
    acc[r.emoji]!.count++;
    if (r.userId === currentUserId) {
      acc[r.emoji]!.userReacted = true;
      acc[r.emoji]!.reactionId = r.id;
    }
    return acc;
  }, {});

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`no-select group relative flex max-w-[85%] items-end gap-2 sm:max-w-[70%] ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}
        translate="no"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Avatar — shown at the LAST message in a consecutive group */}
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
          {/* Action button — hover on desktop */}
          {!isOptimistic && (
            <button
              onClick={() => setShowMenu((v) => !v)}
              className={`absolute top-1/2 hidden -translate-y-1/2 rounded-full p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100 sm:block dark:hover:bg-gray-700 dark:hover:text-gray-300 ${
                isOwn ? "-left-8" : "-right-8"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
          )}

          {/* Context menu — emoji row + action icons */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div
                className={`absolute z-50 flex items-center gap-0.5 rounded-full border border-gray-200 bg-white px-1.5 py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${
                  isOwn ? "right-0 bottom-full mb-1.5" : "left-0 bottom-full mb-1.5"
                }`}
              >
                {/* Quick emoji reactions */}
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => void handleReact(emoji)}
                    className="rounded-full p-1.5 text-base transition-transform hover:scale-125 hover:bg-gray-100 active:scale-95 dark:hover:bg-gray-700"
                  >
                    {emoji}
                  </button>
                ))}

                {/* Divider */}
                {isOwn && (
                  <div className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />
                )}

                {/* Edit icon (own messages only) */}
                {isOwn && (
                  <button
                    onClick={handleStartEdit}
                    className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                    title="Edit"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}

                {/* Delete icon (own messages only) */}
                {isOwn && (
                  <button
                    onClick={() => void handleDelete()}
                    className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Sender name for group chats */}
          {showSenderName && (
            <p className="mb-0.5 px-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {message.sender.name}
            </p>
          )}

          {/* Message bubble */}
          {editing ? (
            <div className="rounded-2xl rounded-br-md border-2 border-blue-400 bg-white px-3 py-2 shadow-sm dark:bg-gray-700">
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full min-w-[200px] resize-none bg-transparent text-[15px] leading-relaxed text-gray-900 outline-none dark:text-white"
                rows={1}
              />
              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSaveEdit()}
                  className="rounded-md bg-blue-500 px-2.5 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-2xl shadow-sm ${
                message.type === "image" && message.fileUrl ? "overflow-hidden" : "px-3.5 py-2.5"
              } ${
                isOwn
                  ? "rounded-br-md bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                  : "rounded-bl-md bg-white text-gray-800 ring-1 ring-gray-100 dark:bg-gray-700/80 dark:text-gray-100 dark:ring-gray-600/30"
              } ${isOptimistic ? "opacity-70" : ""}`}
            >
              {/* Image message */}
              {message.type === "image" && message.fileUrl ? (
                <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.fileUrl}
                    alt={message.fileName ?? "Image"}
                    className="max-h-64 max-w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                </a>
              ) : message.type === "audio" && message.fileUrl ? (
                /* Audio message */
                <div className="flex flex-col gap-1.5">
                  <audio controls preload="metadata" className="h-10 max-w-[250px]">
                    <source src={message.fileUrl} type={message.mimeType ?? "audio/mpeg"} />
                  </audio>
                  <span className="text-[11px] opacity-70">{message.fileName}</span>
                </div>
              ) : message.type === "file" && message.fileUrl ? (
                /* File attachment */
                <a
                  href={message.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isOwn ? "bg-white/20" : "bg-gray-100 dark:bg-gray-600"}`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{message.fileName}</p>
                    {message.fileSize && (
                      <p className="text-[11px] opacity-60">
                        {message.fileSize < 1024 * 1024
                          ? `${Math.round(message.fileSize / 1024)} KB`
                          : `${(message.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                      </p>
                    )}
                  </div>
                </a>
              ) : (
                /* Text message */
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                  {message.content}
                </p>
              )}
            </div>
          )}

          {/* Reactions display */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className={`mt-0.5 flex flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
              {Object.entries(groupedReactions).map(([emoji, data]) => (
                <button
                  key={emoji}
                  onClick={() => void handleReact(emoji)}
                  className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
                    data.userReacted
                      ? "border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10"
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                  }`}
                >
                  <span>{emoji}</span>
                  {data.count > 1 && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{data.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}

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
