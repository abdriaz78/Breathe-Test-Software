"use client";

import { useEffect } from "react";

/** The browser's install prompt event (Chromium only; not in the TS DOM lib). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __quintronInstallPrompt?: BeforeInstallPromptEvent | null;
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export const INSTALL_PROMPT_EVENT = "quintron:installprompt";

/**
 * Mounted once in the root layout:
 *  - registers the service worker (production builds only — in `next dev` the
 *    chunk URLs are not content-hashed, so caching them would break hot reload;
 *    any worker left over from a production run is removed);
 *  - captures `beforeinstallprompt` as early as possible and stashes it on
 *    window, so an Install button that mounts later can still use it.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault(); // we show our own Install button instead of the mini-infobar
      window.__quintronInstallPrompt = e;
      window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    };
    const onInstalled = () => {
      window.__quintronInstallPrompt = null;
      window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
          console.warn("[pwa] service worker registration failed", err);
        });
      } else {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
