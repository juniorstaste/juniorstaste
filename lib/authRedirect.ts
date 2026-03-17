const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getAuthRedirectUrl(path = "/auth/callback") {
  if (appUrl) {
    return `${normalizeBaseUrl(appUrl)}${path}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }

  return undefined;
}
