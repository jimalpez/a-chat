"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { useChatStore, type ChatUser } from "@/lib/store";
import { useTheme } from "@/hooks/useTheme";
import { Avatar } from "./Avatar";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "dms" | "groups";

function SidebarSkeleton() {
  return (
    <div className="flex-1 overflow-hidden px-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl px-3 py-3">
          <div className="skeleton h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-4 w-3/4 rounded-md" />
            <div className="skeleton h-3 w-1/2 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const { data: session } = useSession();
  const { themeMode, cycleTheme } = useTheme();
  const {
    selectedUser,
    setSelectedUser,
    selectedGroup,
    setSelectedGroup,
    onlineUsers,
    searchQuery,
    setSearchQuery,
    unreadCounts,
    clearUnread,
    setSidebarOpen,
    setActiveView,
  } = useChatStore();

  const [tab, setTab] = useState<Tab>("dms");
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const { data: users, isLoading: usersLoading } = api.user.search.useQuery(
    { query: searchQuery },
    { refetchInterval: 10000 },
  );

  const { data: groups, isLoading: groupsLoading } = api.group.getMyGroups.useQuery(
    undefined,
    { refetchInterval: 5000 },
  );

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user);
    clearUnread(user.id);
    setActiveView("chat");
    setSidebarOpen(false);
  };

  const handleSelectGroup = (group: { id: string; name: string; image: string | null; memberCount: number }) => {
    setSelectedGroup(group);
    clearUnread(group.id);
    setActiveView("chat");
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          {/* Avatar — opens profile on desktop, hidden on mobile (BottomNav handles it) */}
          {session?.user && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { setActiveView("profile"); setSidebarOpen(false); }}
              className="hidden shrink-0 rounded-full md:block"
              title="View profile"
            >
              <Avatar name={session.user.name ?? "User"} image={session.user.image} size="sm" online colorSeed={session.user.id} />
            </motion.button>
          )}
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Chats</h1>
        </div>
        <div className="flex items-center gap-0.5">
          {tab === "groups" && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateGroup(true)}
              className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
              title="New group"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={cycleTheme}
            className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            title={`Theme: ${themeMode}`}
          >
            {themeMode === "light" ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : themeMode === "dark" ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            )}
          </motion.button>
        </div>
      </div>

      {/* Search */}
      {tab === "dms" && (
        <div className="px-4 pb-2 pt-1">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border-0 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-500/30"
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mx-4 mt-2 mb-2 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(["dms", "groups"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === t
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            {tab === t && (
              <motion.div
                layoutId="sidebar-tab"
                className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-slate-700"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{t === "dms" ? "Direct" : "Groups"}</span>
          </button>
        ))}
      </div>

      {/* User / Group list — pb-16 on mobile reserves space for BottomNav */}
      {tab === "dms" ? (
        usersLoading ? (
          <SidebarSkeleton />
        ) : (
          <div className="flex-1 overflow-y-auto px-2 py-1 pb-16 md:pb-2">
            {(() => {
              const onlineList = users?.filter((u) => onlineUsers.has(u.id)) ?? [];
              const offlineList = users?.filter((u) => !onlineUsers.has(u.id)) ?? [];

              const renderUser = (user: ChatUser, index: number) => {
                const isOnline = onlineUsers.has(user.id);
                const isSelected = selectedUser?.id === user.id;
                const unread = unreadCounts[user.id] ?? 0;

                return (
                  <motion.button
                    key={user.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.15 }}
                    onClick={() => handleSelectUser(user)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition-all ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-500/10"
                        : "hover:bg-slate-50 active:scale-[0.98] dark:hover:bg-slate-800/70"
                    }`}
                  >
                    <Avatar name={user.name} image={user.image} online={isOnline} colorSeed={user.id} />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-[14px] font-semibold ${
                          isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-100"
                        }`}>
                          {user.name}
                        </p>
                        {unread > 0 && (
                          <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-bold text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {isOnline ? <span className="font-medium text-emerald-500">Active now</span> : "Offline"}
                      </p>
                    </div>
                  </motion.button>
                );
              };

              if (users?.length === 0) {
                return (
                  <div className="flex flex-col items-center px-4 py-16">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <svg className="h-7 w-7 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No users found</p>
                  </div>
                );
              }

              return (
                <>
                  {onlineList.length > 0 && (
                    <div className="mb-1">
                      <div className="flex items-center gap-2 px-3 pb-1.5 pt-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Online — {onlineList.length}
                        </span>
                      </div>
                      {onlineList.map((user, i) => renderUser(user, i))}
                    </div>
                  )}
                  {offlineList.length > 0 && (
                    <div className="mb-1">
                      <div className="flex items-center gap-2 px-3 pb-1.5 pt-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Offline — {offlineList.length}
                        </span>
                      </div>
                      {offlineList.map((user, i) => renderUser(user, i + onlineList.length))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )
      ) : groupsLoading ? (
        <SidebarSkeleton />
      ) : (
        <div className="flex-1 overflow-y-auto px-2 py-1 pb-16 md:pb-2">
          <AnimatePresence>
            {groups?.map((group, i) => {
              const isSelected = selectedGroup?.id === group.id;
              return (
                <motion.button
                  key={group.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.15 }}
                  onClick={() => handleSelectGroup(group)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition-all ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-500/10"
                      : "hover:bg-slate-50 active:scale-[0.98] dark:hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white shadow-sm">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-[14px] font-semibold ${
                        isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-100"
                      }`}>
                        {group.name}
                      </p>
                      {group.unreadCount > 0 && (
                        <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-bold text-white">
                          {group.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {group.lastMessage
                        ? `${group.lastMessage.sender.name}: ${group.lastMessage.content}`
                        : `${group.memberCount} members`}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>

          {groups?.length === 0 && (
            <div className="flex flex-col items-center px-4 py-16">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <svg className="h-7 w-7 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="mb-3 text-sm font-medium text-slate-400 dark:text-slate-500">No groups yet</p>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-600 hover:shadow-md"
              >
                Create Group
              </button>
            </div>
          )}
        </div>
      )}

      <CreateGroupDialog open={showCreateGroup} onClose={() => setShowCreateGroup(false)} />
    </div>
  );
}
