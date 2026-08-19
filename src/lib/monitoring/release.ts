/** Build-time release id, injected by vite `define`. */
declare const __APP_RELEASE__: string | undefined;

export function appRelease(): string {
  try {
    return typeof __APP_RELEASE__ === "string" && __APP_RELEASE__ ? __APP_RELEASE__ : "dev";
  } catch {
    return "dev";
  }
}
