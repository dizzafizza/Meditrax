import { Outlet } from "react-router-dom";
import { UIProvider, useUI } from "@/context/UIContext";
import BottomTabBar from "@/components/BottomTabBar";
import QuickAddSheet from "@/components/sheets/QuickAddSheet";
import MedicationFormSheet from "@/components/sheets/MedicationFormSheet";
import QuickLogSheet from "@/components/sheets/QuickLogSheet";
import CheckinSheet from "@/components/sheets/CheckinSheet";
import InstallPrompt from "@/components/InstallPrompt";

function Shell() {
  const ui = useUI();
  return (
    <div className="relative min-h-screen mx-auto w-full max-w-2xl">
      <main className="relative z-10 pb-tabbar min-h-screen">
        <Outlet />
      </main>
      <BottomTabBar onQuickAdd={ui.openQuickAdd} />
      <InstallPrompt />
      <QuickAddSheet />
      <MedicationFormSheet />
      <QuickLogSheet />
      <CheckinSheet />
    </div>
  );
}

export default function Layout() {
  return (
    <UIProvider>
      <Shell />
    </UIProvider>
  );
}
