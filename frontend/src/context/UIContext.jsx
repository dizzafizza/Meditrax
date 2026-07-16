import { createContext, useContext, useState, useCallback } from "react";

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }) {
  const [medSheet, setMedSheet] = useState({ open: false, med: null, prefill: null });
  const [logSheet, setLogSheet] = useState({ open: false, med: null, time: null, dose: null, log: null });
  const [quickAdd, setQuickAdd] = useState(false);
  const [checkinSheet, setCheckinSheet] = useState({ open: false, checkin: null });

  const openAddMed = useCallback((prefill = null) => setMedSheet({ open: true, med: null, prefill }), []);
  const openEditMed = useCallback((med) => setMedSheet({ open: true, med, prefill: null }), []);
  const closeMed = useCallback(() => setMedSheet((s) => ({ ...s, open: false })), []);
  const openQuickLog = useCallback((med, time = null, dose = null) => setLogSheet({ open: true, med, time, dose, log: null }), []);
  const openEditLog = useCallback((log, med) => setLogSheet({ open: true, med, time: log?.scheduled_time || null, dose: null, log }), []);
  const closeQuickLog = useCallback(() => setLogSheet((s) => ({ ...s, open: false })), []);
  const openQuickAdd = useCallback(() => setQuickAdd(true), []);
  const closeQuickAdd = useCallback(() => setQuickAdd(false), []);
  // Guard: openCheckin is often used directly as an onClick handler, which
  // passes the click event — only treat real records (with an id) as an edit.
  const openCheckin = useCallback((checkin = null) => setCheckinSheet({ open: true, checkin: checkin && checkin.id ? checkin : null }), []);
  const closeCheckin = useCallback(() => setCheckinSheet((s) => ({ ...s, open: false })), []);

  return (
    <UIContext.Provider
      value={{
        medSheet, logSheet, quickAdd, checkinSheet,
        openAddMed, openEditMed, closeMed,
        openQuickLog, openEditLog, closeQuickLog,
        openQuickAdd, closeQuickAdd,
        openCheckin, closeCheckin,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}
