import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false on the server and during hydration, true once React is attached.
 * On client-side navigation it is true from the first render, so buttons
 * don't flicker disabled when moving between pages.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}