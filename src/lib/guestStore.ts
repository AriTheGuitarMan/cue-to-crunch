import type { Tables } from "@/integrations/supabase/types";

const SESSIONS_KEY = "toneforge_guest_sessions";
const KNOWLEDGE_KEY = "toneforge_guest_knowledge";
const PROFILE_KEY = "toneforge_guest_profile";

export type GuestProfile = {
  display_name: string;
  lifetime_time_saved_minutes: number;
  lifetime_money_saved: number;
};

const defaultProfile: GuestProfile = {
  display_name: "Guest Producer",
  lifetime_time_saved_minutes: 0,
  lifetime_money_saved: 0,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getGuestSessions() {
  return readJson<Tables<"sessions">[]>(SESSIONS_KEY, []);
}

export function saveGuestSessions(sessions: Tables<"sessions">[]) {
  writeJson(SESSIONS_KEY, sessions);
}

export function appendGuestSession(session: Tables<"sessions">) {
  const sessions = getGuestSessions();
  sessions.unshift(session);
  saveGuestSessions(sessions);
}

export function getGuestKnowledge() {
  return readJson<Tables<"knowledge_base">[]>(KNOWLEDGE_KEY, []);
}

export function saveGuestKnowledge(entries: Tables<"knowledge_base">[]) {
  writeJson(KNOWLEDGE_KEY, entries);
}

export function appendGuestKnowledge(entry: Tables<"knowledge_base">) {
  const entries = getGuestKnowledge();
  entries.unshift(entry);
  saveGuestKnowledge(entries);
}

export function getGuestProfile() {
  return {
    ...defaultProfile,
    ...readJson<Partial<GuestProfile>>(PROFILE_KEY, {}),
  };
}

export function updateGuestProfile(patch: Partial<GuestProfile>) {
  const next = { ...getGuestProfile(), ...patch };
  writeJson(PROFILE_KEY, next);
  return next;
}
