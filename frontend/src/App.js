import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { AIToolsProvider } from "@/context/AIToolsContext";
import { scheduleAllReminders } from "@/lib/push";
import Layout from "@/components/Layout";
import Today from "@/pages/Today";
import Medications from "@/pages/Medications";
import MedicationDetail from "@/pages/MedicationDetail";
import CalendarPage from "@/pages/CalendarPage";
import Insights from "@/pages/Insights";
import Inventory from "@/pages/Inventory";
import TaperPlanner from "@/pages/TaperPlanner";
import TaperDetail from "@/pages/TaperDetail";
import CyclicDosing from "@/pages/CyclicDosing";
import CapsuleCalculator from "@/pages/CapsuleCalculator";
import KnowledgeBase from "@/pages/KnowledgeBase";
import KnowledgeArticle from "@/pages/KnowledgeArticle";
import Assistant from "@/pages/Assistant";
import Effects from "@/pages/Effects";
import Reminders from "@/pages/Reminders";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import More from "@/pages/More";
import Legal from "@/pages/Legal";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 15000, retry: 1 } },
});

function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
    // Schedule local (on-device) reminders while the app is open / installed.
    const run = () => { scheduleAllReminders().catch(() => {}); };
    run();
    const onVis = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", run);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", run);
    };
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <div className="App noise">
          <BrowserRouter>
            <ProfileProvider>
              <AIToolsProvider>
                <Routes>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Today />} />
                    <Route path="/medications" element={<Medications />} />
                    <Route path="/medications/:id" element={<MedicationDetail />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/taper" element={<TaperPlanner />} />
                    <Route path="/taper/:id" element={<TaperDetail />} />
                    <Route path="/cyclic" element={<CyclicDosing />} />
                    <Route path="/capsules" element={<CapsuleCalculator />} />
                    <Route path="/knowledge" element={<KnowledgeBase />} />
                    <Route path="/knowledge/:id" element={<KnowledgeArticle />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/effects" element={<Effects />} />
                    <Route path="/reminders" element={<Reminders />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/more" element={<More />} />
                    <Route path="/legal" element={<Legal />} />
                    <Route path="/legal/:doc" element={<Legal />} />
                    <Route path="*" element={<Today />} />
                  </Route>
                </Routes>
              </AIToolsProvider>
            </ProfileProvider>
          </BrowserRouter>
          <Toaster position="top-center" richColors closeButton />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
