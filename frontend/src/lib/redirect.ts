const unsafePrefixes = ["//", "/admin", "/sign-in", "/register"];

export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || unsafePrefixes.some((prefix) => path.startsWith(prefix))) {
    return fallback;
  }
  return path;
}

export function signInPath(redirectTo: string): string {
  return `/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`;
}
