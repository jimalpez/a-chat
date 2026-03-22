"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket, isSocketConnected } from "@/lib/socket";
import { useChatStore } from "@/lib/store";
import { api } from "@/trpc/react";
import { motion } from "framer-motion";

interface MessageInputProps {
  currentUserId: string;
}

interface UploadResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  type: "image" | "file" | "audio";
}

export function MessageInput({ currentUserId }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUser = useChatStore((s) => s.selectedUser);
  const selectedGroup = useChatStore((s) => s.selectedGroup);
  const chatMode = useChatStore((s) => s.chatMode);
  const addMessage = useChatStore((s) => s.addMessage);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);

  const utils = api.useUtils();
  const invalidateAfterSend = () => { void utils.message.getConversation.invalidate(); void utils.message.getUnreadCounts.invalidate(); };
  const sendMutation = api.message.send.useMutation({ onSuccess: invalidateAfterSend });
  const groupSendMutation = api.group.sendMessage.useMutation({
    onSuccess: () => { void utils.group.getMessages.invalidate(); void utils.group.getMyGroups.invalidate(); },
  });

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!selectedUser) return;
    const socket = getSocket();
    if (socket && isSocketConnected()) socket.emit("typing", { receiverId: selectedUser.id, isTyping });
  }, [selectedUser]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    autoResize();
    if (chatMode === "dm") {
      sendTypingIndicator(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 1500);
    }
  };

  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) { const err = await res.json() as { error: string }; console.error("Upload failed:", err.error); return null; }
    return res.json() as Promise<UploadResult>;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const target = chatMode === "dm" ? selectedUser : selectedGroup;
    if (!target) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      if (!result) return;
      const content = result.type === "image" ? `[Image] ${result.fileName}` : result.type === "audio" ? `[Audio] ${result.fileName}` : `[File] ${result.fileName}`;

      if (chatMode === "dm" && selectedUser) {
        const tempId = `temp-${Date.now()}`;
        addMessage({ id: tempId, content, type: result.type, senderId: currentUserId, receiverId: selectedUser.id, createdAt: new Date().toISOString(), read: false, fileUrl: result.url, fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType, sender: { id: currentUserId, name: "", image: null } });
        const message = await sendMutation.mutateAsync({ receiverId: selectedUser.id, content });
        useChatStore.getState().replaceOptimisticMessage(tempId, { id: message.id, content: message.content, senderId: message.senderId, receiverId: message.receiverId, createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt), read: false, fileUrl: result.url, fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType, type: result.type, sender: message.sender });
      } else if (chatMode === "group" && selectedGroup) {
        const tempId = `temp-${Date.now()}`;
        addMessage({ id: tempId, content, type: result.type, senderId: currentUserId, receiverId: selectedGroup.id, createdAt: new Date().toISOString(), read: false, fileUrl: result.url, fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType, sender: { id: currentUserId, name: "", image: null } });
        const msg = await groupSendMutation.mutateAsync({ groupId: selectedGroup.id, content });
        useChatStore.getState().replaceOptimisticMessage(tempId, { id: msg.id, content: msg.content, senderId: msg.senderId, receiverId: selectedGroup.id, createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt), read: false, fileUrl: result.url, fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType, type: result.type, sender: msg.sender, reactions: msg.reactions ?? [] });
        void utils.group.getMessages.invalidate();
      }
    } catch (err) { console.error("Failed to send file:", err); } finally { setUploading(false); }
  };

  const handleSend = async () => {
    const target = chatMode === "dm" ? selectedUser : selectedGroup;
    if (!text.trim() || !target || sending) return;
    const content = text.trim();
    setSending(true);
    if (chatMode === "dm") { sendTypingIndicator(false); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Capture reply data before clearing
    const currentReplyTo = replyingTo ? {
      id: replyingTo.id,
      content: replyingTo.content,
      sender: { id: replyingTo.senderId, name: replyingTo.sender.name },
    } : null;
    const currentReplyToId = replyingTo?.id;
    setReplyingTo(null);

    try {
      if (chatMode === "group" && selectedGroup) {
        const tempId = `temp-${Date.now()}`;
        addMessage({ id: tempId, content, senderId: currentUserId, receiverId: selectedGroup.id, createdAt: new Date().toISOString(), read: false, sender: { id: currentUserId, name: "", image: null } });
        const msg = await groupSendMutation.mutateAsync({ groupId: selectedGroup.id, content });
        useChatStore.getState().replaceOptimisticMessage(tempId, { id: msg.id, content: msg.content, senderId: msg.senderId, receiverId: selectedGroup.id, createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt), read: false, sender: msg.sender, reactions: msg.reactions ?? [] });
        void utils.group.getMessages.invalidate();
      } else if (selectedUser) {
        const tempId = `temp-${Date.now()}`;
        addMessage({
          id: tempId,
          content,
          senderId: currentUserId,
          receiverId: selectedUser.id,
          createdAt: new Date().toISOString(),
          read: false,
          sender: { id: currentUserId, name: "", image: null },
          replyToId: currentReplyToId,
          replyTo: currentReplyTo,
        });
        const socket = isSocketConnected() ? getSocket() : null;
        if (socket) {
          socket.emit("send-message", { receiverId: selectedUser.id, content, senderId: currentUserId, tempId, replyToId: currentReplyToId });
        } else {
          sendMutation.mutate(
            { receiverId: selectedUser.id, content, replyToId: currentReplyToId },
            {
              onSuccess: (message) => {
                useChatStore.getState().replaceOptimisticMessage(tempId, {
                  id: message.id,
                  content: message.content,
                  senderId: message.senderId,
                  receiverId: message.receiverId,
                  createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt),
                  read: false,
                  sender: message.sender,
                  replyToId: currentReplyToId,
                  replyTo: currentReplyTo,
                });
              },
            },
          );
        }
      }
    } catch (err) { console.error("Failed to send message:", err); setText(content); } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const isMobile = window.innerWidth < 768;
      if (!isMobile) { e.preventDefault(); void handleSend(); }
    }
  };

  const isBusy = sending || uploading;

  return (
    <div className="border-t border-slate-200/70 bg-white px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Reply bar */}
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border-l-2 border-indigo-400 bg-indigo-50 px-3 py-2 dark:border-indigo-500 dark:bg-indigo-500/10">
          <svg className="h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              Replying to {replyingTo.senderId === currentUserId ? "yourself" : replyingTo.sender.name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {replyingTo.content}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {uploading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
          Uploading file...
        </motion.div>
      )}

      <div className="flex items-end gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-500 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
          title="Attach file"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </motion.button>

        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" onChange={(e) => void handleFileSelect(e)} />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="min-h-[44px] flex-1 resize-none rounded-2xl border-0 bg-slate-100 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-500/30"
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => void handleSend()}
          disabled={!text.trim() || isBusy}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
