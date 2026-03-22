"use client";

import { useSession } from "next-auth/react";
import { useChatStore } from "@/lib/store";
import { Avatar } from "./Avatar";

export function BottomNav() {
  const { data: session } = useSession();
  const activeView = useChatStore((s) => s.activeView);
  const setActiveView = useChatStore((s) => s.setActiveView);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const selectedUser = useChatStore((s) => s.selectedUser);
  const selectedGroup = useChatStore((s) => s.selectedGroup);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);

  if (!session?.user) return null;

  // Hide when inside a conversation (chat panel visible, not sidebar)
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const inConversation = activeView === "chat" && (selectedUser || selectedGroup) && !sidebarOpen;
  if (inConversation) return null;

  const isChat = activeView === "chat";
  const isProfile = activeView === "profile";

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {/* Chats tab */}
        <button
          onClick={() => { setActiveView("chat"); setSidebarOpen(true); }}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${isChat ? "text-indigo-500" : "text-slate-400"}`}
        >
          <svg className="h-6 w-6" fill={isChat ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isChat ? 0 : 1.5}>
            {isChat ? (
              <path d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            )}
          </svg>
          <span className="text-[10px] font-semibold leading-none">Chats</span>
        </button>

        {/* Profile tab */}
        <button
          onClick={() => { setActiveView("profile"); setSidebarOpen(false); }}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${isProfile ? "text-indigo-500" : "text-slate-400"}`}
        >
          <div className={`rounded-full ${isProfile ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""}`}>
            <Avatar name={session.user.name ?? "User"} image={session.user.image} size="xs" colorSeed={session.user.id} />
          </div>
          <span className="text-[10px] font-semibold leading-none">Profile</span>
        </button>
      </div>
    </div>
  );
}
