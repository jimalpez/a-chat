"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket, isSocketConnected } from "@/lib/socket";
import { useChatStore } from "@/lib/store";
import { api } from "@/trpc/react";

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

  const sendMutation = api.message.send.useMutation();
  const groupSendMutation = api.group.sendMessage.useMutation();
  const utils = api.useUtils();

  const sendTypingIndicator = useCallback(
    (isTyping: boolean) => {
      if (!selectedUser) return;
      const socket = getSocket();
      if (socket && isSocketConnected()) {
        socket.emit("typing", { receiverId: selectedUser.id, isTyping });
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
    if (chatMode === "dm") {
      sendTypingIndicator(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 1500);
    }
  };

  // Upload file to server → Supabase Storage
  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json() as { error: string };
      console.error("Upload failed:", err.error);
      return null;
    }

    return res.json() as Promise<UploadResult>;
  };

  // Send a file message (image, doc, audio)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = "";

    const target = chatMode === "dm" ? selectedUser : selectedGroup;
    if (!target) return;

    setUploading(true);

    try {
      const result = await uploadFile(file);
      if (!result) return;

      const content = result.type === "image"
        ? `[Image] ${result.fileName}`
        : result.type === "audio"
          ? `[Audio] ${result.fileName}`
          : `[File] ${result.fileName}`;

      // Send as message with file metadata
      if (chatMode === "dm" && selectedUser) {
        const tempId = `temp-${Date.now()}`;
        addMessage({
          id: tempId,
          content,
          type: result.type,
          senderId: currentUserId,
          receiverId: selectedUser.id,
          createdAt: new Date().toISOString(),
          read: false,
          fileUrl: result.url,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          sender: { id: currentUserId, name: "", image: null },
        });

        const message = await sendMutation.mutateAsync({
          receiverId: selectedUser.id,
          content,
        });

        useChatStore.getState().replaceOptimisticMessage(tempId, {
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          receiverId: message.receiverId,
          createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt),
          read: false,
          fileUrl: result.url,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          type: result.type,
          sender: message.sender,
        });
      } else if (chatMode === "group" && selectedGroup) {
        const tempId = `temp-${Date.now()}`;
        addMessage({
          id: tempId,
          content,
          type: result.type,
          senderId: currentUserId,
          receiverId: selectedGroup.id,
          createdAt: new Date().toISOString(),
          read: false,
          fileUrl: result.url,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          sender: { id: currentUserId, name: "", image: null },
        });

        const msg = await groupSendMutation.mutateAsync({
          groupId: selectedGroup.id,
          content,
        });

        useChatStore.getState().replaceOptimisticMessage(tempId, {
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          receiverId: selectedGroup.id,
          createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt),
          read: false,
          fileUrl: result.url,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          type: result.type,
          sender: msg.sender,
          reactions: msg.reactions ?? [],
        });
        void utils.group.getMessages.invalidate();
      }
    } catch (err) {
      console.error("Failed to send file:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    const target = chatMode === "dm" ? selectedUser : selectedGroup;
    if (!text.trim() || !target || sending) return;

    const content = text.trim();
    setSending(true);

    if (chatMode === "dm") {
      sendTypingIndicator(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      if (chatMode === "group" && selectedGroup) {
        const tempId = `temp-${Date.now()}`;
        addMessage({
          id: tempId,
          content,
          senderId: currentUserId,
          receiverId: selectedGroup.id,
          createdAt: new Date().toISOString(),
          read: false,
          sender: { id: currentUserId, name: "", image: null },
        });
        const msg = await groupSendMutation.mutateAsync({
          groupId: selectedGroup.id,
          content,
        });
        useChatStore.getState().replaceOptimisticMessage(tempId, {
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          receiverId: selectedGroup.id,
          createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt),
          read: false,
          sender: msg.sender,
          reactions: msg.reactions ?? [],
        });
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
        });

        if (isSocketConnected()) {
          const socket = getSocket();
          socket!.emit("send-message", {
            receiverId: selectedUser.id,
            content,
            senderId: currentUserId,
            tempId,
          });
        } else {
          const message = await sendMutation.mutateAsync({
            receiverId: selectedUser.id,
            content,
          });
          useChatStore.getState().replaceOptimisticMessage(tempId, {
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            receiverId: message.receiverId,
            createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt),
            read: false,
            sender: message.sender,
          });
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
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

  const isBusy = sending || uploading;

  return (
    <div className="sticky bottom-0 z-10 border-t border-gray-200/80 bg-white/80 px-4 py-3 glass sm:px-5 sm:py-3.5 dark:border-gray-700/50 dark:bg-gray-900/80">
      {/* Upload progress */}
      {uploading && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Uploading file...
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-95 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          title="Attach file"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          onChange={(e) => void handleFileSelect(e)}
        />

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
          disabled={!text.trim() || isBusy}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25 transition-all active:scale-95 hover:shadow-lg hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
