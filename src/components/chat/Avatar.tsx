"use client";

/** Generates a consistent gradient from a string (user name/id) */
function stringToGradient(str: string): string {
  const gradients = [
    "bg-gradient-to-br from-blue-400 to-blue-600",
    "bg-gradient-to-br from-emerald-400 to-emerald-600",
    "bg-gradient-to-br from-violet-400 to-violet-600",
    "bg-gradient-to-br from-rose-400 to-rose-600",
    "bg-gradient-to-br from-amber-400 to-amber-600",
    "bg-gradient-to-br from-cyan-400 to-cyan-600",
    "bg-gradient-to-br from-pink-400 to-pink-600",
    "bg-gradient-to-br from-indigo-400 to-indigo-600",
    "bg-gradient-to-br from-teal-400 to-teal-600",
    "bg-gradient-to-br from-orange-400 to-orange-600",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length]!;
}

interface AvatarProps {
  name: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}

export function Avatar({ name, image, size = "md", online }: AvatarProps) {
  const sizeClasses = {
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-13 w-13 text-base",
  };

  const dotSizes = {
    sm: "h-2.5 w-2.5 border-[1.5px]",
    md: "h-3 w-3 border-2",
    lg: "h-3.5 w-3.5 border-2",
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative inline-flex shrink-0">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white/50 dark:ring-gray-800/50`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} ${stringToGradient(name)} flex items-center justify-center rounded-full font-semibold text-white shadow-sm`}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`${dotSizes[size]} absolute right-0 bottom-0 rounded-full border-white dark:border-gray-900 ${
            online ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-gray-300 dark:bg-gray-600"
          }`}
        />
      )}
    </div>
  );
}
