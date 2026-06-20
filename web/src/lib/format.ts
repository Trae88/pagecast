export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Shared expiry presets for the per-link picker and the default-expiry setting.
// Values are server duration strings (see parseDuration in src/server.js).
export const EXPIRY_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "6h", label: "6 hours" },
  { value: "12h", label: "12 hours" },
  { value: "1d", label: "1 day" },
  { value: "2d", label: "2 days" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "never", label: "Never" }
];

// Human label for a link's expiry state from its absolute expiresAt (epoch ms).
// null = permanent. A relative "Expires in …" reads best while there's time
// left; an absolute date is the fallback further out.
export function expiryLabel(
  expiresAt: number | null | undefined,
  expired?: boolean
): string {
  if (expired) return "Expired";
  if (expiresAt == null) return "Never";
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "Expired";
  // remaining > 0 here, so never round down to a confusing "Expires in 0m".
  const minutes = Math.max(1, Math.round(remaining / 60_000));
  if (minutes < 60) return `Expires in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Expires in ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 14) return `Expires in ${days} days`;
  return `Expires ${new Date(expiresAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  })}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
