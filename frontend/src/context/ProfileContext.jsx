import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as db from "@/lib/localdb";

const ProfileContext = createContext(null);
export const useProfiles = () => useContext(ProfileContext);

const INVALIDATE_KEYS = [
  "today", "medications", "medication", "inventory", "analytics",
  "tapers", "taper", "cyclic", "reminders", "logs", "profile",
  "knowledge", "knowledge-cats",
];

export function ProfileProvider({ children }) {
  const qc = useQueryClient();
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const list = await db.listProfiles();
    const id = await db.getActiveProfileId();
    setProfiles(list);
    setActiveId(id);
    setReady(true);
    return { list, id };
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const invalidate = useCallback(() => {
    INVALIDATE_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }, [qc]);

  const switchProfile = useCallback(async (id) => {
    await db.setActiveProfile(id);
    setActiveId(id);
    invalidate();
    return id;
  }, [invalidate]);

  const addProfile = useCallback(async (data) => {
    const p = await db.createProfile(data);
    await refresh();
    return p;
  }, [refresh]);

  const editProfile = useCallback(async (id, patch) => {
    const p = await db.updateProfileById(id, patch);
    await refresh();
    return p;
  }, [refresh]);

  const removeProfile = useCallback(async (id) => {
    await db.deleteProfile(id);
    const { id: newActive } = await refresh();
    setActiveId(newActive);
    invalidate();
    return true;
  }, [refresh, invalidate]);

  const active = profiles.find((p) => p.id === activeId) || null;

  return (
    <ProfileContext.Provider
      value={{ profiles, activeId, active, ready, switchProfile, addProfile, editProfile, removeProfile, refresh }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
