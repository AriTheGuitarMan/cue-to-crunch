import type { EffectParams } from "@/lib/effectPresets";
import type { Tables } from "@/integrations/supabase/types";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface SessionDraftArgs {
  userId: string;
  promptText: string;
  refinementNote: string | null;
  inputSource: string;
  durationSeconds: number;
  timeSavedMinutes: number;
  moneySaved: number;
  iterationRound: number;
  parentSessionId: string | null;
  effectParams: EffectParams;
}

export function createSessionDraft(args: SessionDraftArgs): Tables<"sessions"> {
  return {
    id: createSessionId(),
    created_at: new Date().toISOString(),
    user_id: args.userId,
    prompt_text: args.promptText,
    refinement_note: args.refinementNote,
    input_source: args.inputSource,
    input_audio_url: null,
    output_audio_url: null,
    duration_seconds: args.durationSeconds,
    time_saved_minutes: args.timeSavedMinutes,
    money_saved: args.moneySaved,
    iteration_round: args.iterationRound,
    parent_session_id: args.parentSessionId,
    effect_params: JSON.parse(JSON.stringify(args.effectParams)),
  };
}

export function replaceSessionInList(
  sessions: Tables<"sessions">[],
  nextSession: Tables<"sessions">,
) {
  let found = false;
  const updated = sessions.map((session) => {
    if (session.id !== nextSession.id) return session;
    found = true;
    return nextSession;
  });

  return found ? updated : [...updated, nextSession];
}
