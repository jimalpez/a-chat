"use client";

import { useSession, signOut } from "next-auth/react";
import { api } from "@/trpc/react";
import { useChatStore, type ChatUser } from "@/lib/store";
import { Avatar } from "./Avatar";

export function Sidebar() {
  const { data: session } = useSession();
  const {
    selectedUser,
    setSelectedUser,
    onlineUsers,
    searchQuery,
    setSearchQuery,
    unreadCounts,
    clearUnread,
    darkMode,
    toggleDarkMode,
    setSidebarOpen,
  } = useChatStore();

  const { data: users } = api.user.search.useQuery(
    { query: searchQuery },
    { refetchInterval: 30000 },
  );

  const handleSelectUser = (user: ChatUser) => {
    setSelectedUser(user);
    clearUnread(user.id);
    // On mobile, hide sidebar to show chat
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 safe-top dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">
          Chats
        </h1>
        <button
          onClick={toggleDarkMode}
          className="rounded-lg p-2.5 text-gray-500 active:bg-gray-200 hover:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-700 dark:hover:bg-gray-800"
          title={darkMode ? "Light mode" : "Dark mode"}
        >
          {darkMode ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
            className="w-full rounded-xl bg-gray-100 py-2.5 pl-10 pr-4 text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {users?.map((user) => {
          const isOnline = onlineUsers.has(user.id);
          const isSelected = selectedUser?.id === user.id;
          const unread = unreadCounts[user.id] ?? 0;

          return (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user)}
              className={`flex w-full items-center gap-3 px-4 py-3.5 transition-colors active:bg-gray-100 hover:bg-gray-50 dark:active:bg-gray-700 dark:hover:bg-gray-800 ${
                isSelected ? "bg-blue-50 dark:bg-gray-800" : ""
              }`}
            >
              <Avatar name={user.name} image={user.image} online={isOnline} />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between">
                  <p className="truncate font-medium text-gray-900 dark:text-white">
                    {user.name}
                  </p>
                  {unread > 0 && (
                    <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-bold text-white">
                      {unread}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {isOnline ? "Online" : "Offline"}
                </p>
              </div>
            </button>
          );
        })}

        {users?.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            No users found
          </div>
        )}
      </div>

      {/* Current user footer */}
      {session?.user && (
        <div className="border-t border-gray-200 p-4 safe-bottom dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Avatar
              name={session.user.name ?? "User"}
              image={session.user.image}
              size="sm"
              online
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {session.user.name}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="rounded-lg p-2.5 text-gray-500 active:bg-gray-200 hover:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-700 dark:hover:bg-gray-800"
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
