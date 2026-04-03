export function logSupabaseError(context: string, error: unknown) {
  const details =
    error && typeof error === "object"
      ? {
          error,
          message: "message" in error ? (error as { message?: unknown }).message : undefined,
          code: "code" in error ? (error as { code?: unknown }).code : undefined,
          details: "details" in error ? (error as { details?: unknown }).details : undefined,
          hint: "hint" in error ? (error as { hint?: unknown }).hint : undefined,
          json: (() => {
            try {
              return JSON.stringify(error, null, 2);
            } catch {
              return undefined;
            }
          })(),
        }
      : { error };

  console.error(context, details);
}
