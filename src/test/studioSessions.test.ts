import { describe, expect, it } from "vitest";
import { createSessionDraft, replaceSessionInList } from "@/lib/studioSessions";
import { defaultParams } from "@/lib/effectPresets";

describe("studio session drafts", () => {
  it("creates a complete optimistic session draft", () => {
    const session = createSessionDraft({
      userId: "guest-local",
      promptText: "ambient ethereal space",
      refinementNote: null,
      inputSource: "upload",
      durationSeconds: 18,
      timeSavedMinutes: 22,
      moneySaved: 35,
      iterationRound: 1,
      parentSessionId: null,
      effectParams: defaultParams,
    });

    expect(session.id).toBeTruthy();
    expect(session.prompt_text).toBe("ambient ethereal space");
    expect(session.iteration_round).toBe(1);
    expect(session.output_audio_url).toBeNull();
  });

  it("replaces a persisted session without changing list length", () => {
    const original = createSessionDraft({
      userId: "guest-local",
      promptText: "ambient ethereal space",
      refinementNote: null,
      inputSource: "upload",
      durationSeconds: 18,
      timeSavedMinutes: 22,
      moneySaved: 35,
      iterationRound: 1,
      parentSessionId: null,
      effectParams: defaultParams,
    });
    const persisted = {
      ...original,
      output_audio_url: "guest-audio://persisted",
    };

    const updated = replaceSessionInList([original], persisted);

    expect(updated).toHaveLength(1);
    expect(updated[0].output_audio_url).toBe("guest-audio://persisted");
  });
});
