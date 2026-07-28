import { cn } from "@/lib/utils";

// Mascote pixel-art ambar (sem emoji).
export function Robot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("block", className)} aria-hidden="true">
      <rect x="9" y="3" width="2" height="4" fill="var(--robot)" />
      <rect x="21" y="3" width="2" height="4" fill="var(--robot)" />
      <rect x="5" y="7" width="22" height="18" rx="5" fill="var(--robot)" />
      <rect x="11" y="13" width="3" height="6" rx="1.2" fill="#1a1206" />
      <rect x="18" y="13" width="3" height="6" rx="1.2" fill="#1a1206" />
    </svg>
  );
}
