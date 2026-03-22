"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { useChatStore } from "@/lib/store";

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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">New Group</h2>

        <input
          type="text"
          placeholder="Group name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />

        <p className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          Select members ({selectedIds.size})
        </p>

        <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-700">
          {users?.map((user) => (
            <button
              key={user.id}
              onClick={() => toggleUser(user.id)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                selectedIds.has(user.id) ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                selectedIds.has(user.id) ? "border-blue-500 bg-blue-500" : "border-gray-300 dark:border-gray-600"
              }`}>
                {selectedIds.has(user.id) && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || selectedIds.size === 0 || createGroup.isPending}
            className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {createGroup.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </>
  );
}
