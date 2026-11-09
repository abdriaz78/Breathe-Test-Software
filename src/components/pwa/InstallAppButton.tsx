"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { INSTALL_PROMPT_EVENT } from "./ServiceWorkerRegister";

type Platform = "ios" | "android" | "mac-safari" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "mac-safari";
  return "desktop";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const STEPS: Record<Platform, { title: string; steps: string[] }> = {
  ios: {
    title: "Install on iPhone or iPad",
    steps: [
      "Open this page in Safari.",
      "Tap the Share button (the square with an arrow pointing up).",
      "Scroll down and tap “Add to Home Screen”.",
      "Tap “Add”. QuinTron appears on your Home Screen.",
    ],
  },
  android: {
    title: "Install on Android",
    steps: [
      "Open this page in Chrome.",
      "Tap the ⋮ menu in the top-right corner.",
      "Tap “Install app” (or “Add to Home screen”).",
      "Confirm with “Install”.",
    ],
  },
  "mac-safari": {
    title: "Install on Mac (Safari)",
    steps: ["In the menu bar, choose File → Add to Dock.", "Click “Add”. QuinTron opens in its own window."],
  },
  desktop: {
    title: "Install on this computer",
    steps: [
      "Chrome: click the install icon (a monitor with a down-arrow) at the right of the address bar, or ⋮ menu → “Cast, save and share” → “Install page as app”.",
      "Edge: click the “App available” icon in the address bar, or … menu → Apps → “Install this site as an app”.",
      "Firefox doesn’t install web apps on desktop — open this page in Chrome or Edge to install it.",
    ],
  },
};

/**
 * "Install app" button for the sign-in screens. Uses the native install
 * prompt when the browser offers one; otherwise shows platform-specific
 * instructions. Hidden when already running as an installed app.
 */
export function InstallAppButton({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandalone());
    const sync = () => setCanPrompt(!!window.__quintronInstallPrompt);
    const onInstalled = () => setInstalled(true);
    sync();
    window.addEventListener(INSTALL_PROMPT_EVENT, sync);
    window.addEventListener("appinstalled", onInstalled);
    setReady(true);
    return () => {
      window.removeEventListener(INSTALL_PROMPT_EVENT, sync);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showHelp) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowHelp(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showHelp]);

  if (!ready || standalone) return null;

  async function onClick() {
    const evt = window.__quintronInstallPrompt;
    if (evt) {
      await evt.prompt();
      const choice = await evt.userChoice.catch(() => null);
      window.__quintronInstallPrompt = null;
      setCanPrompt(false);
      if (choice?.outcome === "accepted") setInstalled(true);
      return;
    }
    setShowHelp(true);
  }

  if (installed) {
    return (
      <p className={`inline-flex items-center gap-2 text-sm font-medium text-emerald-700 ${className}`} role="status">
        <Icon name="checkCircle" className="h-4 w-4" /> App installed — open QuinTron from your home screen or apps list.
      </p>
    );
  }

  const help = STEPS[platform];
  const base =
    tone === "dark"
      ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
      : "border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        data-testid="install-app"
        data-can-prompt={canPrompt ? "true" : "false"}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${base} ${className}`}
      >
        <Icon name="download" className="h-4 w-4" />
        Install app
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="install-help-title">
          <button aria-label="Close" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
          <div className="relative w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-lift">
            <div className="flex items-start justify-between gap-4">
              <h2 id="install-help-title" className="font-display text-lg font-bold text-slate-900">{help.title}</h2>
              <button onClick={() => setShowHelp(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              {help.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs text-slate-400">
              The installed app opens in its own window and works like a native app. For privacy, patient data is never stored offline on the device.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
