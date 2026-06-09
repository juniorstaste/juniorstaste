// localStorage-Zugriffe, die bei blockiertem Storage nicht crashen.
//
// In Safari mit "Alle Cookies blockieren" (und einigen WebViews) wirft schon
// der Zugriff auf window.localStorage einen SecurityError — ungefangene
// Zugriffe in Effects reißen dann die ganze Seite ab.

export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blockiert oder voll — Feature degradiert still
  }
}

export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage blockiert — nichts zu entfernen
  }
}
