import { createContext, useContext, useState, useCallback } from "react";

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }) {
  const [medSheet, setMedSheet] = useState({ open: false, med: null, prefill: null });
  const [logSheet, setLogSheet] = useState({ open: false, med: null, time: null, dose: null });
  const [quickAdd, setQuickAdd] = useState(false);
  const [checkinSheet, setCheckinSheet] = useState({ open: false });

  const openAddMed = useCallback((prefill = null) => setMedSheet({ open: true, med: null, prefill }), []);
  const openEditMed = useCallback((med) => setMedSheet({ open: true, med, prefill: null }), []);
  const closeMed = useCallback(() => setMedSheet((s) => ({ ...s, open: false })), []);
  const openQuickLog = useCallback((med, time = null, dose = null) => setLogSheet({ open: true, med, time, dose }), []);
  const closeQuickLog = useCallback(() => setLogSheet((s) => ({ ...s, open: false })), []);
  const openQuickAdd = useCallback(() => setQuickAdd(true), []);
  const closeQuickAdd = useCallback(() => setQuickAdd(false), []);
  const openCheckin = useCallback(() => setCheckinSheet({ open: true }), []);
  const closeCheckin = useCallback(() => setCheckinSheet({ open: false }), []);

  return (
    <UIContext.Provider
      value={{
        medSheet, logSheet, quickAdd, checkinSheet,
        openAddMed, openEditMed, closeMed,
        openQuickLog, closeQuickLog,
        openQuickAdd, closeQuickAdd,
        openCheckin, closeCheckin,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}
