"use client";

/** Generates a consistent color from a string (user name/id) */
function stringToColor(str: string): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}

interface AvatarProps {
  name: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}

export function Avatar({ name, image, size = "md", online }: AvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  const dotSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
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
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} ${stringToColor(name)} flex items-center justify-center rounded-full font-semibold text-white`}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`${dotSizes[size]} absolute right-0 bottom-0 rounded-full border-2 border-white dark:border-gray-900 ${
            online ? "bg-emerald-400" : "bg-gray-300"
          }`}
        />
      )}
    </div>
  );
}
