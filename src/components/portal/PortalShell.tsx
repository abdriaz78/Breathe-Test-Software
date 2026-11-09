import { LogoLockup } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";
import { PortalSignOut } from "./PortalSignOut";

/** Minimal chrome for the patient portal — no staff navigation at all. */
export function PortalShell({
  hospitalName,
  children,
}: {
  hospitalName?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-clinical-bg">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <LogoLockup />
          <div className="flex-1" />
          {hospitalName && (
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
              <Icon name="building" className="h-3.5 w-3.5" /> {hospitalName}
            </span>
          )}
          <PortalSignOut />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </main>
    </div>
  );
}
