"use client";

import { useState, useRef, useCallback } from "react";
import { useChatStore, type ChatMessage } from "@/lib/store";
import { api } from "@/trpc/react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "./Avatar";

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
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);

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
    try { await deleteMutation.mutateAsync({ messageId: message.id }); } catch { /* reappears on refetch */ }
  }, [message.id, isOptimistic, removeMessage, deleteMutation]);

  const handleStartEdit = useCallback(() => {
    setShowMenu(false);
    setEditText(message.content);
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  }, [message.content]);

  const handleSaveEdit = useCallback(async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.content) { setEditing(false); return; }
    setEditing(false);
    updateMessageContent(message.id, trimmed);
    try { await editMutation.mutateAsync({ messageId: message.id, content: trimmed }); } catch { updateMessageContent(message.id, message.content); }
  }, [editText, message.id, message.content, updateMessageContent, editMutation]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSaveEdit(); }
    if (e.key === "Escape") setEditing(false);
  }, [handleSaveEdit]);

  const handleReply = useCallback(() => {
    if (isOptimistic) return;
    setShowMenu(false);
    setReplyingTo(message);
  }, [message, isOptimistic, setReplyingTo]);

  const handleReact = useCallback(async (emoji: string) => {
    if (isOptimistic) return;
    setShowMenu(false);
    const existing = (message.reactions ?? []).find((r) => r.emoji === emoji && r.userId === currentUserId);
    if (existing) {
      removeReaction(message.id, existing.id);
      try { await removeReactionMutation.mutateAsync({ reactionId: existing.id }); } catch { /* resync */ }
    } else {
      const tempReaction = { id: `temp-${Date.now()}`, emoji, userId: currentUserId, messageId: message.id };
      addReaction(message.id, tempReaction);
      try {
        const real = await addReactionMutation.mutateAsync({ messageId: message.id, emoji });
        removeReaction(message.id, tempReaction.id);
        addReaction(message.id, real);
      } catch { removeReaction(message.id, tempReaction.id); }
    }
  }, [message, isOptimistic, currentUserId, addReaction, removeReaction, addReactionMutation, removeReactionMutation]);

  const handleTouchStart = useCallback(() => {
    if (isOptimistic) return;
    longPressTimer.current = setTimeout(() => setShowMenu(true), 500);
  }, [isOptimistic]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const reactions = message.reactions ?? [];
  const groupedReactions = reactions.reduce<Record<string, { count: number; userReacted: boolean; reactionId?: string }>>((acc, r) => {
    acc[r.emoji] ??= { count: 0, userReacted: false };
    acc[r.emoji]!.count++;
    if (r.userId === currentUserId) { acc[r.emoji]!.userReacted = true; acc[r.emoji]!.reactionId = r.id; }
    return acc;
  }, {});

  const replyTo = message.replyTo;

  return (
    <div className={`animate-message-in flex ${isOwn ? "justify-end" : "justify-start"} mb-1.5`}>
      <div
        className={`no-select group relative flex max-w-[80%] items-end gap-2 sm:max-w-[65%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}
        translate="no"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Avatar */}
        {!isOwn && (
          <div className="h-7 w-7 shrink-0">
            {showAvatar && (
              <Avatar name={message.sender.name} image={message.sender.image} size="xs" colorSeed={message.senderId} />
            )}
          </div>
        )}

        <div className="relative min-w-0">
          {/* Hover action button */}
          {!isOptimistic && (
            <button
              onClick={() => setShowMenu((v) => !v)}
              className={`absolute bottom-[15%] hidden -translate-y-1/2 rounded-full bg-slate-200 p-1.5 text-slate-600 opacity-0 shadow-sm transition-all hover:bg-slate-300 hover:text-slate-800 group-hover:opacity-100 sm:block dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-white ${isOwn ? "-left-8" : "-right-8"}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
          )}

          {/* Context menu */}
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6, y: 8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className={`absolute z-50 flex items-center gap-0.5 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800 ${isOwn ? "right-0 bottom-full mb-1.5" : "left-0 bottom-full mb-1.5"}`}
                >
                  {QUICK_EMOJIS.map((emoji, i) => (
                    <motion.button
                      key={emoji}
                      initial={{ opacity: 0, scale: 0, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20, delay: i * 0.04 }}
                      whileHover={{ scale: 1.3, y: -4 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => void handleReact(emoji)}
                      className="rounded-full p-1.5 text-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      {emoji}
                    </motion.button>
                  ))}

                  {/* Divider */}
                  <motion.div initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ delay: QUICK_EMOJIS.length * 0.04 }} className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />

                  {/* Reply button — always visible */}
                  <motion.button
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20, delay: QUICK_EMOJIS.length * 0.04 + 0.02 }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleReply}
                    className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-500 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
                    title="Reply"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </motion.button>

                  {/* Edit (own only) */}
                  {isOwn && (
                    <motion.button initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20, delay: QUICK_EMOJIS.length * 0.04 + 0.04 }} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={handleStartEdit} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-500 dark:hover:bg-slate-700 dark:hover:text-indigo-400" title="Edit">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </motion.button>
                  )}

                  {/* Delete (own only) */}
                  {isOwn && (
                    <motion.button initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20, delay: QUICK_EMOJIS.length * 0.04 + 0.06 }} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => void handleDelete()} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400" title="Delete">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </motion.button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Sender name */}
          {showSenderName && (
            <p className="mb-0.5 px-1 text-[11px] font-semibold text-indigo-500 dark:text-indigo-400">
              {message.sender.name}
            </p>
          )}

          {/* Reply quote — separate bubble above the message */}
          {replyTo && (
            <div className={`rounded-2xl px-4 py-2.5 ${
              isOwn
                ? "rounded-br-sm bg-indigo-400/80 dark:bg-indigo-600/60"
                : "rounded-bl-sm bg-slate-200/80 dark:bg-slate-700"
            }`}>
              <p className={`text-[13px] leading-relaxed ${
                isOwn ? "text-white/80" : "text-slate-600 dark:text-slate-300"
              }`}>
                {replyTo.content.length > 120 ? replyTo.content.slice(0, 120) + "..." : replyTo.content}
              </p>
            </div>
          )}

          {/* Message bubble */}
          {editing ? (
            <div className="rounded-2xl rounded-br-md border-2 border-indigo-400 bg-white px-3.5 py-2.5 shadow-sm dark:bg-slate-800">
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full min-w-[200px] resize-none bg-transparent text-[15px] leading-relaxed text-slate-900 outline-none dark:text-white"
                rows={1}
              />
              <div className="mt-1.5 flex items-center justify-end gap-2">
                <button onClick={() => setEditing(false)} className="text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300">Cancel</button>
                <button onClick={() => void handleSaveEdit()} className="rounded-lg bg-indigo-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-600">Save</button>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-2xl ${
                message.type === "image" && message.fileUrl ? "overflow-hidden" : "px-4 py-2.5"
              } ${
                isOwn
                  ? "rounded-br-sm bg-indigo-500 text-white w-fit ml-auto"
                  : "rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              } ${isOptimistic ? "opacity-50" : ""}`}
            >
              {message.type === "image" && message.fileUrl ? (
                <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={message.fileUrl} alt={message.fileName ?? "Image"} className="max-h-64 max-w-full rounded-lg object-cover" loading="lazy" />
                </a>
              ) : message.type === "audio" && message.fileUrl ? (
                <div className="flex flex-col gap-1.5">
                  <audio controls preload="metadata" className="h-10 max-w-[250px]"><source src={message.fileUrl} type={message.mimeType ?? "audio/mpeg"} /></audio>
                  <span className="text-[11px] opacity-70">{message.fileName}</span>
                </div>
              ) : message.type === "file" && message.fileUrl ? (
                <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isOwn ? "bg-white/20" : "bg-slate-100 dark:bg-slate-700"}`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{message.fileName}</p>
                    {message.fileSize && <p className="text-[11px] opacity-60">{message.fileSize < 1024 * 1024 ? `${Math.round(message.fileSize / 1024)} KB` : `${(message.fileSize / (1024 * 1024)).toFixed(1)} MB`}</p>}
                  </div>
                </a>
              ) : (
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.content}</p>
              )}
            </div>
          )}

          {/* Reactions */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className={`mt-1 flex flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
              {Object.entries(groupedReactions).map(([emoji, data]) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => void handleReact(emoji)}
                  className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-all ${
                    data.userReacted
                      ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{emoji}</span>
                  {data.count > 1 && <span className="text-[10px] text-slate-500 dark:text-slate-400">{data.count}</span>}
                </motion.button>
              ))}
            </div>
          )}

          {/* Timestamp + status */}
          <div className={`mt-0.5 flex items-center gap-1 px-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatTime(message.createdAt)}</span>
            {isOwn && (
              isOptimistic ? <ClockIcon className="text-slate-400" /> :
              message.read ? <DoubleCheck className="text-indigo-400" /> :
              <SingleCheck className="text-slate-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
