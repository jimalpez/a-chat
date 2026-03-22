"use client";

/**
 * 20 distinct gradients — enough to visually distinguish users.
 * The color is determined by hashing `colorSeed` (user ID) or `name`.
 * Same seed always produces the same gradient.
 */
const AVATAR_GRADIENTS = [
  "from-rose-500 to-pink-600",
  "from-orange-500 to-amber-600",
  "from-amber-500 to-yellow-600",
  "from-lime-500 to-green-600",
  "from-emerald-500 to-teal-600",
  "from-teal-500 to-cyan-600",
  "from-cyan-500 to-sky-600",
  "from-sky-500 to-blue-600",
  "from-blue-500 to-indigo-600",
  "from-indigo-500 to-violet-600",
  "from-violet-500 to-purple-600",
  "from-purple-500 to-fuchsia-600",
  "from-fuchsia-500 to-pink-600",
  "from-red-500 to-rose-600",
  "from-emerald-400 to-cyan-600",
  "from-blue-400 to-purple-600",
  "from-pink-400 to-violet-600",
  "from-amber-400 to-red-500",
  "from-teal-400 to-blue-600",
  "from-indigo-400 to-pink-600",
];

function seedToGradient(seed: string): string {
  // djb2 hash — fast, good distribution
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]!;
}

interface AvatarProps {
  name: string;
  image?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  online?: boolean;
  /** Stable ID (e.g. user.id) used to pick the gradient color. Falls back to name if not provided. */
  colorSeed?: string;
}

export function Avatar({ name, image, size = "md", online, colorSeed }: AvatarProps) {
  const sizeClasses = {
    xs: "h-7 w-7 text-[10px]",
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-24 w-24 text-2xl",
  };

  const dotSizes = {
    xs: "h-2 w-2 border",
    sm: "h-2.5 w-2.5 border-[1.5px]",
    md: "h-3 w-3 border-2",
    lg: "h-3.5 w-3.5 border-2",
    xl: "h-4 w-4 border-[3px]",
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const gradient = seedToGradient(colorSeed ?? name);

  return (
    <div className="relative inline-flex shrink-0">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white/60 dark:ring-slate-800/60`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} bg-gradient-to-br ${gradient} flex items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white/20 dark:ring-slate-800/20`}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`${dotSizes[size]} absolute right-0 bottom-0 rounded-full border-white dark:border-slate-900 ${
            online
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
              : "bg-slate-300 dark:bg-slate-600"
          }`}
        />
      )}
    </div>
  );
}
