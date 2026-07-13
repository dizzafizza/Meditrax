import { useEffect, useState } from "react";
import { X, Share, Plus, Bell } from "lucide-react";
import { isIOS, isStandalone } from "@/lib/push";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    if (localStorage.getItem("meditrax-install-dismissed") === "1") return;
    if (isStandalone()) return;
    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    // iOS has no beforeinstallprompt — show manual hint after a moment
    const t = setTimeout(() => { if (isIOS() && !isStandalone()) setShow(true); }, 2500);
    return () => { window.removeEventListener("beforeinstallprompt", onBip); clearTimeout(t); };
  }, []);

  const dismiss = () => { setShow(false); localStorage.setItem("meditrax-install-dismissed", "1"); };
  const install = async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice; dismiss(); }
  };

  if (!show) return null;
  return (
    <div className="fixed left-3 right-3 z-50" style={{ bottom: "calc(var(--tabbar-h) + var(--sab) + 14px)" }}>
      <div className="mx-auto max-w-md card-soft p-4 animate-rise">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Install Meditrax</p>
            {isIOS() ? (
              <p className="text-sm text-muted-foreground mt-0.5">
                Tap <Share className="inline h-4 w-4 -mt-0.5" /> then <span className="font-medium text-foreground">Add to Home Screen</span> to enable reminders &amp; offline use.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">Add Meditrax to your home screen for reminders and a native feel.</p>
            )}
            {!isIOS() && deferred && (
              <button onClick={install} data-testid="pwa-install-cta" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                <Plus className="h-4 w-4" /> Install now
              </button>
            )}
          </div>
          <button onClick={dismiss} aria-label="Dismiss" className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
