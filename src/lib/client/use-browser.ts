"use client";
import * as React from "react";

/** Browser state via useSyncExternalStore: correct on first client render, no setState-in-effect. */
function useBrowserValue<T>(subscribe: (cb: () => void) => () => void, get: () => T, server: T) {
  return React.useSyncExternalStore(subscribe, get, () => server);
}

const subOnline = (cb: () => void) => {
  addEventListener("online", cb);
  addEventListener("offline", cb);
  return () => { removeEventListener("online", cb); removeEventListener("offline", cb); };
};
export const useOnline = () => useBrowserValue(subOnline, () => navigator.onLine, true);

const subFullscreen = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};
export const useIsFullscreen = () => useBrowserValue(subFullscreen, () => !!document.fullscreenElement, true);

const noop = () => () => {};
export const useFullscreenSupported = () => useBrowserValue(noop, () => !!document.fullscreenEnabled, true);

/** Read a sessionStorage string once on the client (stable primitive, safe for SSR). */
export const useSessionItem = (key: string) => useBrowserValue(noop, () => sessionStorage.getItem(key), null);
