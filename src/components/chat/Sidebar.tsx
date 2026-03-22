"use client";

import { useSession, signOut } from "next-auth/react";
import { api } from "@/trpc/react";
import { useChatStore, type ChatUser } from "@/lib/store";
import { useTheme } from "@/hooks/useTheme";
import { Avatar } from "./Avatar";

function SidebarSkeleton() {
  return (
    <div className="flex-1 overflow-hidden px-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3.5">
          <div className="skeleton h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
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
    onlineUsers,
    searchQuery,
    setSearchQuery,
    unreadCounts,
    clearUnread,
    setSidebarOpen,
  } = useChatStore();

  const { data: users, isLoading } = api.user.search.useQuery(
    { query: searchQuery },
    { refetchInterval: 30000 },
  );

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user);
    clearUnread(user.id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-full flex-col bg-gray-50/80 dark:bg-gray-900/95">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Messages
        </h1>
        <button
          onClick={cycleTheme}
          className="rounded-xl p-2.5 text-gray-500 transition-colors active:bg-gray-200 hover:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-700 dark:hover:bg-gray-800"
          title={`Theme: ${themeMode}`}
        >
          {themeMode === "light" ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : themeMode === "dark" ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-gray-700 placeholder-gray-400 shadow-sm outline-none transition-shadow focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-blue-500"
          />
        </div>
      </div>

      {/* User list */}
      {isLoading ? (
        <SidebarSkeleton />
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-2 pb-4">
          {(() => {
            const onlineList = users?.filter((u) => onlineUsers.has(u.id)) ?? [];
            const offlineList = users?.filter((u) => !onlineUsers.has(u.id)) ?? [];

            const renderUser = (user: ChatUser) => {
              const isOnline = onlineUsers.has(user.id);
              const isSelected = selectedUser?.id === user.id;
              const unread = unreadCounts[user.id] ?? 0;

              return (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3.5 transition-all active:scale-[0.98] ${
                    isSelected
                      ? "bg-blue-50 shadow-sm dark:bg-blue-500/10"
                      : "hover:bg-white dark:hover:bg-gray-800/60"
                  }`}
                >
                  <Avatar name={user.name} image={user.image} online={isOnline} />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <p className={`truncate font-medium ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                        {user.name}
                      </p>
                      {unread > 0 && (
                        <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-bold text-white shadow-sm">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {isOnline ? (
                        <span className="text-emerald-500">Online</span>
                      ) : (
                        "Offline"
                      )}
                    </p>
                  </div>
                </button>
              );
            };

            if (users?.length === 0) {
              return (
                <div className="px-4 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    No users found
                  </p>
                </div>
              );
            }

            return (
              <>
                {/* Online users */}
                {onlineList.length > 0 && (
                  <div className="mb-1">
                    <div className="flex items-center gap-2 px-3 pb-1 pt-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Online — {onlineList.length}
                      </span>
                    </div>
                    {onlineList.map(renderUser)}
                  </div>
                )}

                {/* Offline users */}
                {offlineList.length > 0 && (
                  <div className="mb-1">
                    <div className="flex items-center gap-2 px-3 pb-1 pt-3">
                      <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Offline — {offlineList.length}
                      </span>
                    </div>
                    {offlineList.map(renderUser)}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Current user footer */}
      {session?.user && (
        <div className="border-t border-gray-200/80 bg-white/60 px-5 py-4 glass dark:border-gray-700/50 dark:bg-gray-900/60">
          <div className="flex items-center gap-3">
            <Avatar
              name={session.user.name ?? "User"}
              image={session.user.image}
              size="sm"
              online
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {session.user.name}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="rounded-xl p-2.5 text-gray-400 transition-colors active:bg-gray-200 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:active:bg-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="Sign out"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
