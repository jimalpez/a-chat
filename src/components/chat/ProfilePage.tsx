"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useChatStore } from "@/lib/store";
import { useTheme } from "@/hooks/useTheme";
import { api } from "@/trpc/react";
import { Avatar } from "./Avatar";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeToPush, getExistingSubscription } from "@/lib/push";

function StatItem({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <span className="text-lg font-bold text-slate-900 dark:text-white">{value}</span>
      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{label}</span>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  subtitle,
  onClick,
  danger,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onClick?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-colors ${
        danger
          ? "hover:bg-red-50 dark:hover:bg-red-500/10"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/70"
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          danger
            ? "bg-red-100 text-red-500 dark:bg-red-500/10 dark:text-red-400"
            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${danger ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>
          {label}
        </p>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</p>}
      </div>
      {trailing ?? (
        <svg className="h-4 w-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

// Theme icon that correctly reflects light / dark / system
function ThemeIcon({ mode }: { mode: string }) {
  if (mode === "dark") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    );
  }
  if (mode === "light") {
    return (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  // system
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

// Toggle switch component
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        enabled ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Notification Settings Sheet
function NotificationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const { data: vapidData } = api.notification.getVapidPublicKey.useQuery(undefined, { enabled: open });
  const subscribeMutation = api.notification.subscribe.useMutation();
  const unsubscribeMutation = api.notification.unsubscribe.useMutation();

  // Check current push subscription status on open
  useEffect(() => {
    if (!open) return;
    setSoundEnabled(localStorage.getItem("chat-sound-enabled") !== "false");

    void (async () => {
      try {
        const sub = await getExistingSubscription();
        setPushEnabled(!!sub);
      } catch {
        setPushEnabled(false);
      }
    })();
  }, [open]);

  const handleTogglePush = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (pushEnabled) {
        // Unsubscribe
        const sub = await getExistingSubscription();
        if (sub) {
          await unsubscribeMutation.mutateAsync({ endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        // Subscribe
        if (!vapidData?.key) return;
        const sub = await subscribeToPush(vapidData.key);
        if (sub) {
          await subscribeMutation.mutateAsync(sub);
          setPushEnabled(true);
        }
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
    } finally {
      setLoading(false);
    }
  }, [pushEnabled, loading, vapidData?.key, subscribeMutation, unsubscribeMutation]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("chat-sound-enabled", String(next));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed z-50 max-h-[85vh] w-[90vw] max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl inset-x-auto inset-y-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 dark:bg-slate-900"
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Notifications</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-1">
              {/* Push notifications */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Push Notifications</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Get notified of new messages</p>
                  </div>
                </div>
                <Toggle enabled={pushEnabled} onToggle={() => void handleTogglePush()} />
              </div>

              {/* Sound */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Message Sound</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Play sound on new messages</p>
                  </div>
                </div>
                <Toggle enabled={soundEnabled} onToggle={handleToggleSound} />
              </div>
            </div>

            {pushEnabled && (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                Push notifications are active. You&apos;ll receive alerts even when the app is closed.
              </p>
            )}

            {!pushEnabled && (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Enable push notifications to stay updated when you&apos;re away.
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Edit Profile Sheet
function EditProfileSheet({
  open,
  onClose,
  currentName,
  currentBio,
  currentImage,
}: {
  open: boolean;
  onClose: () => void;
  currentName: string;
  currentBio: string;
  currentImage: string | null;
}) {
  const [name, setName] = useState(currentName);
  const [bio, setBio] = useState(currentBio);
  const [imageUrl, setImageUrl] = useState(currentImage ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();
  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: () => {
      void utils.user.me.invalidate();
      onClose();
    },
  });

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json() as { url: string };
        setImageUrl(data.url);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    updateProfile.mutate({
      name: name.trim() || undefined,
      bio: bio.trim(),
      image: imageUrl || null,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed z-50 max-h-[85vh] w-[90vw] max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl inset-x-auto inset-y-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl dark:bg-slate-900"
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Profile</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Avatar upload */}
            <div className="mb-6 flex flex-col items-center">
              <div className="relative">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="Avatar" className="h-24 w-24 rounded-full object-cover" />
                ) : (
                  <Avatar name={currentName} size="xl" colorSeed={currentName} />
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-white shadow-md transition-colors hover:bg-indigo-600 disabled:opacity-50 dark:border-slate-900"
                >
                  {uploading ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleUploadAvatar(e)} />
              <p className="mt-2 text-xs text-slate-400">Tap to change photo</p>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="w-full rounded-xl border-0 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white"
                placeholder="Your name"
              />
            </div>

            {/* Bio */}
            <div className="mb-6">
              <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                Bio
                <span className="text-[11px] text-slate-400">{bio.length}/150</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 150))}
                rows={3}
                className="w-full resize-none rounded-xl border-0 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-white"
                placeholder="Tell people about yourself..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateProfile.isPending}
                className="flex-1 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
              >
                {updateProfile.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ProfilePage() {
  const { data: session } = useSession();
  const { setActiveView, setSidebarOpen } = useChatStore();
  const { themeMode, cycleTheme } = useTheme();
  const [editOpen, setEditOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: profile } = api.user.me.useQuery(undefined, { staleTime: 10000 });
  const { data: groups } = api.group.getMyGroups.useQuery(undefined, { staleTime: 30000 });
  const { data: users } = api.user.search.useQuery({ query: "" }, { staleTime: 30000 });

  const user = session?.user;
  if (!user) return null;

  const handleBack = () => {
    setActiveView("chat");
    setSidebarOpen(true);
  };

  const displayName = profile?.name ?? user.name ?? "User";
  const displayImage = profile?.image ?? user.image ?? null;
  const displayBio = profile?.bio ?? "";
  const themeLabel = themeMode === "light" ? "Light" : themeMode === "dark" ? "Dark" : "System";

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white px-4 py-3.5 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Profile</h2>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center px-6 pb-5 pt-8"
        >
          <div className="relative mb-4">
            <Avatar name={displayName} image={displayImage} size="xl" online colorSeed={user.id} />
            <button
              onClick={() => setEditOpen(true)}
              className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-white shadow-md transition-colors hover:bg-indigo-600 dark:border-slate-950"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{displayName}</h3>
          <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-500">{user.email}</p>
          {displayBio ? (
            <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">{displayBio}</p>
          ) : (
            <button
              onClick={() => setEditOpen(true)}
              className="mt-2 text-sm font-medium text-indigo-500 transition-colors hover:text-indigo-600 dark:text-indigo-400"
            >
              + Add bio
            </button>
          )}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mx-4 mb-6 flex items-center rounded-2xl bg-white px-2 py-4 sm:mx-6 dark:bg-slate-900"
        >
          <StatItem value={users?.length ?? 0} label="Contacts" />
          <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
          <StatItem value={groups?.length ?? 0} label="Groups" />
          <div className="h-8 w-px bg-slate-100 dark:bg-slate-800" />
          <StatItem value="E2EE" label="Encryption" />
        </motion.div>

        {/* Settings section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mx-4 mb-4 sm:mx-6"
        >
          <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Settings
          </p>
          <div className="rounded-2xl bg-white dark:bg-slate-900">
            <MenuRow
              icon={
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              label="Edit Profile"
              subtitle="Name, photo, bio"
              onClick={() => setEditOpen(true)}
            />
            <MenuRow
              icon={<ThemeIcon mode={themeMode} />}
              label="Appearance"
              subtitle={`${themeLabel} mode`}
              onClick={cycleTheme}
              trailing={
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {themeLabel}
                </span>
              }
            />
            <MenuRow
              icon={
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              }
              label="Notifications"
              subtitle="Push, sound, alerts"
              onClick={() => setNotifOpen(true)}
            />
            <MenuRow
              icon={
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              }
              label="Privacy & Security"
              subtitle="Encryption, blocked users"
            />
          </div>
        </motion.div>

        {/* Danger zone */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-4 mb-8 sm:mx-6"
        >
          <div className="rounded-2xl bg-white dark:bg-slate-900">
            <MenuRow
              icon={
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              }
              label="Sign Out"
              danger
              onClick={() => signOut()}
              trailing={null}
            />
          </div>
        </motion.div>

        {/* Version */}
        <div className="pb-20 text-center md:pb-8">
          <p className="text-[11px] text-slate-300 dark:text-slate-700">A-Chat v1.0</p>
        </div>
      </div>

      {/* Notification Settings Sheet */}
      <NotificationSheet open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Edit Profile Sheet */}
      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        currentName={displayName}
        currentBio={displayBio}
        currentImage={displayImage}
      />
    </div>
  );
}
