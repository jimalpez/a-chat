"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { useChatStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupDialog({ open, onClose }: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const setSelectedGroup = useChatStore((s) => s.setSelectedGroup);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);

  const { data: users } = api.user.search.useQuery({ query: "" });
  const createGroup = api.group.create.useMutation();
  const utils = api.useUtils();

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.size === 0) return;
    const group = await createGroup.mutateAsync({
      name: name.trim(),
      memberIds: [...selectedIds],
    });
    void utils.group.getMyGroups.invalidate();
    setSelectedGroup({
      id: group.id,
      name: group.name,
      image: group.image,
      memberCount: group.members.length,
    });
    setSidebarOpen(false);
    setName("");
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="glass fixed inset-x-4 top-[10%] z-50 mx-auto max-w-sm rounded-3xl border border-slate-200/60 bg-white/90 p-6 shadow-2xl dark:border-slate-700/60 dark:bg-slate-800/90"
          >
            <h2 className="mb-5 text-lg font-bold text-slate-900 dark:text-white">New Group</h2>

            <input
              type="text"
              placeholder="Group name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-4 w-full rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-2.5 text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-white"
            />

            <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Select members ({selectedIds.size})
            </p>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200/60 dark:border-slate-700/50">
              {users?.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    selectedIds.has(user.id)
                      ? "bg-indigo-50 dark:bg-indigo-500/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                    selectedIds.has(user.id)
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-slate-300 dark:border-slate-600"
                  }`}>
                    {selectedIds.has(user.id) && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{user.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => void handleCreate()}
                disabled={!name.trim() || selectedIds.size === 0 || createGroup.isPending}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50"
              >
                {createGroup.isPending ? "Creating..." : "Create"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
