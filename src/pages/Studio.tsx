import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Play, Square, Zap, RotateCcw, Mic, FileAudio, Check, RefreshCw } from "lucide-react";
import { parsePrompt, refineParamsFromPrompt, EffectParams, defaultParams } from "@/lib/effectPresets";
import { loadAudioFile, createEngine, connectAndPlay, playDry, stopPlayback, destroyEngine, applyParams, renderProcessedBuffer, AudioEngineState } from "@/lib/audioEngine";
import { analyzeSourceAudio, applyAiToneStrategy, type SourceAudioProfile } from "@/lib/aiToneEngine";
import { extractMono, isAudibleDelta, measureDryWetDelta } from "@/lib/audioQuality";
import Waveform from "@/components/studio/Waveform";
import EffectKnobs from "@/components/studio/EffectKnobs";
import LiveRecorder from "@/components/studio/LiveRecorder";
import ValueSummary from "@/components/studio/ValueSummary";
import DAWExport from "@/components/studio/DAWExport";
import IterationHistory from "@/components/studio/IterationHistory";
import EffectChainSummary from "@/components/studio/EffectChainSummary";
import GrowthAutomationSuite from "@/components/studio/GrowthAutomationSuite";
import StudioLayout from "@/components/studio/StudioLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateSavings } from "@/components/studio/ValueSummary";
import { appendGuestKnowledge, appendGuestSession, getGuestSessions, getGuestProfile, replaceGuestSession, updateGuestProfile } from "@/lib/guestStore";
import { isGuestAudioRef, loadGuestAudioBlob, parseGuestAudioRef, saveGuestAudioBlob } from "@/lib/guestAudioStore";
import { audioBufferToWavBlob } from "@/lib/audioEncoding";
import { createSessionDraft, replaceSessionInList } from "@/lib/studioSessions";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useSearchParams } from "react-router-dom";

const promptSuggestions = [
  "warm blues tone with smooth reverb",
  "heavy metal crunch, tight low-end",
  "shoegaze dreamy wall of sound",
  "funky clean with wah and compression",
  "ambient ethereal space",
  "classic rock overdrive",
];

const refinementSuggestions = [
  "make it brighter and more punchy",
  "add wider stereo space",
  "tighter low end, less muddiness",
  "more saturation, less reverb tail",
  "smoother highs and softer attack",
  "make it more aggressive in the mids",
];

function extractStoragePathFromPublicUrl(url: string) {
  const marker = "/audio-files/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

function sanitizeFileStem(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "audio";
}

function fileNameFromUrl(url: string) {
  if (isGuestAudioRef(url)) {
    const parsed = parseGuestAudioRef(url);
    return parsed?.fileName ?? "session-audio.wav";
  }
  const parts = decodeURIComponent(url).split("/");
  return parts[parts.length - 1] || "session-audio.webm";
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitForIdle(timeout = 2000) {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || typeof window.requestIdleCallback !== "function") {
      setTimeout(resolve, 0);
      return;
    }

    window.requestIdleCallback(() => resolve(), { timeout });
  });
}

function markInteraction(ref: { current: number }) {
  ref.current = Date.now();
}

type SessionAudioRef = {
  id: string;
  parent_session_id: string | null;
  input_audio_url: string | null;
  created_at: string;
};

function resolveInputAudioUrlForSession(session: SessionAudioRef, sessions: SessionAudioRef[]) {
  const byId = new Map(sessions.map((s) => [s.id, s]));

  let cursor: SessionAudioRef | undefined = session;
  let rootId = session.id;
  while (cursor) {
    if (cursor.input_audio_url) return cursor.input_audio_url;
    if (!cursor.parent_session_id) {
      rootId = cursor.id;
      break;
    }
    rootId = cursor.parent_session_id;
    cursor = byId.get(cursor.parent_session_id);
  }

  const isDescendantOfRoot = (candidate: SessionAudioRef) => {
    let walk: SessionAudioRef | undefined = candidate;
    let guard = 0;
    while (walk && guard < 25) {
      if (walk.id === rootId) return true;
      if (!walk.parent_session_id) return false;
      walk = byId.get(walk.parent_session_id);
      guard++;
    }
    return false;
  };

  const withAudio = sessions
    .filter((s) => !!s.input_audio_url && isDescendantOfRoot(s))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return withAudio[0]?.input_audio_url ?? null;
}

const Studio = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [inputTab, setInputTab] = useState<"upload" | "record">("upload");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [inputSource, setInputSource] = useState<"upload" | "recording">("upload");
  const [generationMode, setGenerationMode] = useState<"fresh" | "modify">("fresh");
  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<EffectParams>(defaultParams);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<"wet" | "dry">("wet");
  const [isGenerated, setIsGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Iterative generation state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [iterationRound, setIterationRound] = useState(1);
  const [iterations, setIterations] = useState<Tables<"sessions">[]>([]);
  const [showRefine, setShowRefine] = useState(false);
  const [refinementNote, setRefinementNote] = useState("");
  const [comparePlayingId, setComparePlayingId] = useState<string | null>(null);
  const [loadedSessionLabel, setLoadedSessionLabel] = useState<string | null>(null);
  const [sessionAudioUrl, setSessionAudioUrl] = useState<string | null>(null);
  const [aiReasons, setAiReasons] = useState<string[]>([]);
  const [sourceProfile, setSourceProfile] = useState<SourceAudioProfile | null>(null);
  const [historyToneRefs, setHistoryToneRefs] = useState<Array<{ prompt: string; effectParams: EffectParams }>>([]);

  const engineRef = useRef<AudioEngineState | null>(null);
  const compareEngineRef = useRef<AudioEngineState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isPlayingRef = useRef(false);
  const lastInteractionRef = useRef(Date.now());

  useEffect(() => {
    return () => {
      if (engineRef.current) destroyEngine(engineRef.current);
      if (compareEngineRef.current) destroyEngine(compareEngineRef.current);
    };
  }, []);

  useEffect(() => {
    if (!audioBuffer) {
      setSourceProfile(null);
      return;
    }
    setSourceProfile(analyzeSourceAudio(audioBuffer));
  }, [audioBuffer]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const waitForInteractionPause = useCallback(async (minimumIdleMs = 4000) => {
    while (isPlayingRef.current || Date.now() - lastInteractionRef.current < minimumIdleMs) {
      await wait(200);
    }
    await waitForIdle();
  }, []);

  useEffect(() => {
    if (!user) {
      const refs = getGuestSessions()
        .filter((row) => !!row.effect_params)
        .slice(0, 40)
        .map((row) => ({
          prompt: `${row.prompt_text} ${row.refinement_note ?? ""}`.trim(),
          effectParams: row.effect_params as unknown as EffectParams,
        }));
      setHistoryToneRefs(refs);
      return;
    }

    supabase
      .from("sessions")
      .select("prompt_text, refinement_note, effect_params")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        const refs = (data ?? [])
          .filter((row) => !!row.effect_params)
          .map((row) => ({
            prompt: `${row.prompt_text} ${row.refinement_note ?? ""}`.trim(),
            effectParams: row.effect_params as unknown as EffectParams,
          }));
        setHistoryToneRefs(refs);
      });
  }, [user]);

  const handleFileUpload = useCallback(async (file: File, options?: { preserveSession?: boolean }) => {
    try {
      if (engineRef.current) destroyEngine(engineRef.current);
      const buffer = await loadAudioFile(file);
      setAudioFile(file);
      setAudioBuffer(buffer);
      if (options?.preserveSession) {
        setIsGenerated(true);
      } else {
        setIsGenerated(false);
        setSessionId(null);
        setParams(defaultParams);
        setIterationRound(1);
        setIterations([]);
        setLoadedSessionLabel(null);
        setSessionAudioUrl(null);
      }
      setShowRefine(false);
    } catch {
      toast.error("Could not decode audio file.");
    }
  }, []);

  const loadAudioFromSessionUrl = useCallback(async (url: string) => {
    let blob: Blob | null = null;

    if (isGuestAudioRef(url)) {
      blob = await loadGuestAudioBlob(url);
    }

    if (!blob) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) blob = await response.blob();
      } catch {
        // fallback below
      }
    }

    if (!blob) {
      const storagePath = extractStoragePathFromPublicUrl(url) ?? (url.includes("/") && !url.startsWith("http") ? url : null);
      if (storagePath) {
        const { data, error } = await supabase.storage.from("audio-files").download(storagePath);
        if (!error) blob = data;
      }
    }

    if (!blob) throw new Error("Could not download session audio");

    const rawName = fileNameFromUrl(url);
    const restoredName = rawName.includes("__")
      ? rawName.split("__").slice(1).join("__")
      : rawName.replace(/^\d+-/, "");
    return new File([blob], restoredName, { type: blob.type || "audio/webm" });
  }, []);

  useEffect(() => {
    const loadSessionId = searchParams.get("loadSession");
    if (!loadSessionId) return;
    let cancelled = false;

    const loadSessionWithAudio = async () => {
      const allSessions: Tables<"sessions">[] = user
        ? (await supabase.from("sessions").select("*").eq("user_id", user.id)).data ?? []
        : getGuestSessions();
      const data = allSessions.find((session) => session.id === loadSessionId);
      if (!data || cancelled) return;

      const byId = new Map((allSessions ?? []).map((s) => [s.id, s]));
      const getRootId = (session: Tables<"sessions">) => {
        let cursor: Tables<"sessions"> | undefined = session;
        let guard = 0;
        while (cursor?.parent_session_id && guard < 25) {
          cursor = byId.get(cursor.parent_session_id);
          guard++;
        }
        return cursor?.id ?? session.id;
      };
      const rootId = getRootId(data as Tables<"sessions">);
      const chain = (allSessions ?? [])
        .filter((s) => getRootId(s as Tables<"sessions">) === rootId)
        .sort((a, b) => a.iteration_round - b.iteration_round);
      const audioUrlToLoad = resolveInputAudioUrlForSession(
        data as unknown as SessionAudioRef,
        (allSessions as SessionAudioRef[]) ?? [],
      );

      setSessionId(data.id);
      setPrompt(data.prompt_text);
      setIterationRound(data.iteration_round);
      setGenerationMode("modify");
      setIterations(chain as Tables<"sessions">[]);
      setInputSource((data.input_source as "upload" | "recording") ?? "upload");
      setSessionAudioUrl(audioUrlToLoad);
      if (data.effect_params) {
        setParams(data.effect_params as unknown as EffectParams);
      }
      setLoadedSessionLabel(`Loaded session from ${new Date(data.created_at).toLocaleString()}`);

      if (audioUrlToLoad) {
        try {
          const file = await loadAudioFromSessionUrl(audioUrlToLoad);
          await handleFileUpload(file, { preserveSession: true });
          if (!cancelled) toast.success("Generation loaded with source audio.");
        } catch (error) {
          console.error("Could not restore session audio:", error);
          if (!cancelled) toast.error("Session loaded, but source audio could not be restored.");
        }
      } else {
        toast.info("Session loaded. Upload audio to continue tweaking.");
      }
    };

    loadSessionWithAudio();
    return () => {
      cancelled = true;
    };
  }, [searchParams, user, handleFileUpload, loadAudioFromSessionUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleRecordingComplete = useCallback(async (file: File) => {
    setInputSource("recording");
    setInputTab("upload");
    await handleFileUpload(file);
  }, [handleFileUpload]);

  const ensureInputAudioUrl = useCallback(async (
    file: File | null,
    existingUrl: string | null,
  ) => {
    if (!file) return null;
    if (existingUrl) return existingUrl;

    if (!user) {
      const localUrl = await saveGuestAudioBlob(file, file.name);
      return localUrl;
    }

    const originalName = file.name.replace(/[\\/]/g, "_");
    const filePath = `${user.id}/inputs/${Date.now()}__${originalName}`;
    const { error } = await supabase.storage.from("audio-files").upload(filePath, file, {
      contentType: file.type || "audio/webm",
      upsert: false,
    });
    if (error) {
      console.error("Input audio upload failed:", error);
      return null;
    }

    const { data } = supabase.storage.from("audio-files").getPublicUrl(filePath);
    return data.publicUrl;
  }, [user]);

  const ensureOutputAudioUrl = useCallback(async (
    buffer: AudioBuffer | null,
    file: File | null,
    round: number,
    effectParams: EffectParams,
  ) => {
    if (!buffer) return null;
    const inputStem = file ? sanitizeFileStem(file.name) : "output";
    let processed = await renderProcessedBuffer(buffer, effectParams);
    const delta = measureDryWetDelta(extractMono(buffer), extractMono(processed));
    if (!isAudibleDelta(delta)) {
      const forcedParams: EffectParams = {
        ...effectParams,
        distortion: Math.min(1, effectParams.distortion + 0.2),
        overdrive: Math.min(1, effectParams.overdrive + 0.2),
        reverb: Math.min(1, effectParams.reverb + 0.12),
        compression: Math.min(1, effectParams.compression + 0.1),
        gain: Math.min(2, effectParams.gain + 0.15),
      };
      processed = await renderProcessedBuffer(buffer, forcedParams);
      console.warn("Output had low dry/wet delta; applied forced audible delta fallback.", delta);
    }
    const outputBlob = await audioBufferToWavBlob(processed);

    if (!user) {
      const outputName = `${inputStem}-round-${round}.wav`;
      return saveGuestAudioBlob(outputBlob, outputName);
    }

    const outputFilePath = `${user.id}/outputs/${Date.now()}-${inputStem}-round-${round}.wav`;
    const { error } = await supabase.storage.from("audio-files").upload(outputFilePath, outputBlob, {
      contentType: "audio/wav",
      upsert: false,
    });
    if (error) {
      console.error("Output audio upload failed:", error);
      return null;
    }
    const { data } = supabase.storage.from("audio-files").getPublicUrl(outputFilePath);
    return data.publicUrl;
  }, [user]);

  const persistSessionMetadata = useCallback(async (
    sessionDraft: Tables<"sessions">,
    options: {
      audioBuffer: AudioBuffer | null;
      audioFile: File | null;
      sessionAudioUrl: string | null;
    },
  ) => {
    const inputAudioUrl = await ensureInputAudioUrl(options.audioFile, options.sessionAudioUrl);
    const sessionToSave: Tables<"sessions"> = {
      ...sessionDraft,
      input_audio_url: inputAudioUrl,
    };

    if (!user) {
      appendGuestSession(sessionToSave);

      const profile = getGuestProfile();
      updateGuestProfile({
        lifetime_time_saved_minutes: profile.lifetime_time_saved_minutes + Number(sessionToSave.time_saved_minutes ?? 0),
        lifetime_money_saved: profile.lifetime_money_saved + Number(sessionToSave.money_saved ?? 0),
      });

      const tags = sessionToSave.prompt_text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      appendGuestKnowledge({
        id: `${sessionToSave.id}-kb`,
        created_at: sessionToSave.created_at,
        user_id: "guest-local",
        session_id: sessionToSave.id,
        summary: `${sessionToSave.prompt_text}${sessionToSave.refinement_note ? ` → ${sessionToSave.refinement_note}` : ""}`,
        tags: tags.slice(0, 10),
      });

      return sessionToSave;
    }

    const { data, error } = await supabase.from("sessions").insert([{
      id: sessionToSave.id,
      user_id: user.id,
      prompt_text: sessionToSave.prompt_text,
      refinement_note: sessionToSave.refinement_note,
      input_source: sessionToSave.input_source,
      input_audio_url: sessionToSave.input_audio_url,
      output_audio_url: sessionToSave.output_audio_url,
      duration_seconds: sessionToSave.duration_seconds,
      time_saved_minutes: sessionToSave.time_saved_minutes,
      money_saved: sessionToSave.money_saved,
      iteration_round: sessionToSave.iteration_round,
      parent_session_id: sessionToSave.parent_session_id,
      effect_params: sessionToSave.effect_params,
    }]).select().single();

    if (error) {
      console.error("Save session error:", error);
      return null;
    }

    // Update lifetime savings
    const { data: profile } = await supabase
      .from("profiles")
      .select("lifetime_time_saved_minutes, lifetime_money_saved")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile) {
      await supabase.from("profiles").update({
        lifetime_time_saved_minutes: profile.lifetime_time_saved_minutes + Number(sessionToSave.time_saved_minutes ?? 0),
        lifetime_money_saved: profile.lifetime_money_saved + Number(sessionToSave.money_saved ?? 0),
      }).eq("user_id", user.id);
    }

    // Save to knowledge base
    const tags = sessionToSave.prompt_text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    await supabase.from("knowledge_base").insert({
      user_id: user.id,
      session_id: data.id,
      summary: `${sessionToSave.prompt_text}${sessionToSave.refinement_note ? ` → ${sessionToSave.refinement_note}` : ""}`,
      tags: tags.slice(0, 10),
    });

    return data;
  }, [user, ensureInputAudioUrl]);

  const persistSessionOutput = useCallback(async (
    sessionDraft: Tables<"sessions">,
    options: {
      audioBuffer: AudioBuffer | null;
      audioFile: File | null;
    },
  ) => {
    const outputAudioUrl = await ensureOutputAudioUrl(
      options.audioBuffer,
      options.audioFile,
      sessionDraft.iteration_round,
      sessionDraft.effect_params as unknown as EffectParams,
    );
    if (!outputAudioUrl) return null;

    const sessionWithOutput: Tables<"sessions"> = {
      ...sessionDraft,
      output_audio_url: outputAudioUrl,
    };

    if (!user) {
      replaceGuestSession(sessionWithOutput);
      return sessionWithOutput;
    }

    const { data, error } = await supabase
      .from("sessions")
      .update({ output_audio_url: outputAudioUrl })
      .eq("user_id", user.id)
      .eq("id", sessionDraft.id)
      .select()
      .single();

    if (error) {
      console.error("Output session update failed:", error);
      return null;
    }

    return data;
  }, [user, ensureOutputAudioUrl]);

  const enqueueSessionPersistence = useCallback((
    sessionDraft: Tables<"sessions">,
    options: {
      audioBuffer: AudioBuffer | null;
      audioFile: File | null;
      sessionAudioUrl: string | null;
    },
  ) => {
    persistQueueRef.current = persistQueueRef.current
      .then(async () => {
        const savedSession = await persistSessionMetadata(sessionDraft, options);
        if (!savedSession) return;

        setIterations((prev) => replaceSessionInList(prev, savedSession));
        if (savedSession.input_audio_url && !sessionAudioUrl) {
          setSessionAudioUrl(savedSession.input_audio_url);
        }

        await waitForInteractionPause();

        const savedOutputSession = await persistSessionOutput(savedSession, {
          audioBuffer: options.audioBuffer,
          audioFile: options.audioFile,
        });
        if (!savedOutputSession) return;
        setIterations((prev) => replaceSessionInList(prev, savedOutputSession));
      })
      .catch((error) => {
        console.error("Queued session persistence failed:", error);
        toast.error("Session save failed, but the current tone is still active.");
      });
  }, [persistSessionMetadata, sessionAudioUrl, waitForInteractionPause, persistSessionOutput]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating || !audioBuffer) return;
    markInteraction(lastInteractionRef);
    setIsGenerating(true);
    try {
      await wait(120);
      const parsedParams = generationMode === "modify"
        ? refineParamsFromPrompt(params, prompt)
        : parsePrompt(prompt);
      const aiResult = applyAiToneStrategy({
        prompt,
        startingParams: params,
        parsedParams,
        history: historyToneRefs,
        sourceProfile,
      });
      const newParams = aiResult.params;
      setParams(newParams);
      setAiReasons(aiResult.reasons);
      setIsGenerated(true);

      if (engineRef.current && isPlaying) {
        applyParams(engineRef.current, newParams);
      }

      const { timeSavedMinutes, moneySaved } = calculateSavings(audioBuffer.duration, {
        params: newParams,
        iterationRound: 1,
        mode: generationMode,
      });
      const sessionDraft = createSessionDraft({
        userId: user?.id ?? "guest-local",
        promptText: prompt,
        refinementNote: null,
        inputSource,
        durationSeconds: audioBuffer.duration,
        timeSavedMinutes,
        moneySaved,
        iterationRound: 1,
        parentSessionId: null,
        effectParams: newParams,
      });

      setSessionId(sessionDraft.id);
      setIterationRound(1);
      setIterations([sessionDraft]);
      setShowRefine(false);
      setRefinementNote("");
      setLoadedSessionLabel(null);
      setComparePlayingId(null);
      setHistoryToneRefs((prev) => [
        {
          prompt: `${sessionDraft.prompt_text} ${sessionDraft.refinement_note ?? ""}`.trim(),
          effectParams: sessionDraft.effect_params as unknown as EffectParams,
        },
        ...prev,
      ].slice(0, 40));
      enqueueSessionPersistence(sessionDraft, {
        audioBuffer,
        audioFile,
        sessionAudioUrl,
      });
    } catch (error) {
      console.error("Generation failed:", error);
      toast.error("Generation failed. Try again with a shorter file or different prompt.");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating, audioBuffer, audioFile, sessionAudioUrl, isPlaying, generationMode, params, historyToneRefs, sourceProfile, user?.id, inputSource, enqueueSessionPersistence]);

  const handleRefine = useCallback(async () => {
    if (!refinementNote.trim() || iterationRound >= 5 || isGenerating || !audioBuffer) return;
    markInteraction(lastInteractionRef);
    setIsGenerating(true);
    try {
      await wait(120);
      const parsedParams = refineParamsFromPrompt(params, refinementNote);
      const aiResult = applyAiToneStrategy({
        prompt: refinementNote,
        startingParams: params,
        parsedParams,
        history: historyToneRefs,
        sourceProfile,
      });
      const newParams = aiResult.params;
      setParams(newParams);
      setAiReasons(aiResult.reasons);

      const newRound = iterationRound + 1;
      setIterationRound(newRound);
      const { timeSavedMinutes, moneySaved } = calculateSavings(audioBuffer.duration, {
        params: newParams,
        iterationRound: newRound,
        mode: generationMode,
      });
      const sessionDraft = createSessionDraft({
        userId: user?.id ?? "guest-local",
        promptText: prompt,
        refinementNote,
        inputSource,
        durationSeconds: audioBuffer.duration,
        timeSavedMinutes,
        moneySaved,
        iterationRound: newRound,
        parentSessionId: sessionId,
        effectParams: newParams,
      });

      setIterations((prev) => [...prev, sessionDraft]);
      setSessionId(sessionDraft.id);
      setHistoryToneRefs((prev) => [
        {
          prompt: `${sessionDraft.prompt_text} ${sessionDraft.refinement_note ?? ""}`.trim(),
          effectParams: sessionDraft.effect_params as unknown as EffectParams,
        },
        ...prev,
      ].slice(0, 40));
      enqueueSessionPersistence(sessionDraft, {
        audioBuffer,
        audioFile,
        sessionAudioUrl,
      });

      setRefinementNote("");
      setShowRefine(false);

      if (engineRef.current && isPlaying) {
        applyParams(engineRef.current, newParams);
      }
    } catch (error) {
      console.error("Refinement failed:", error);
      toast.error("Refinement failed. Try a shorter audio file or simpler refinement note.");
    } finally {
      setIsGenerating(false);
    }
  }, [refinementNote, iterationRound, isGenerating, audioBuffer, audioFile, sessionAudioUrl, params, prompt, sessionId, isPlaying, historyToneRefs, sourceProfile, generationMode, user?.id, inputSource, enqueueSessionPersistence]);

  const handlePlay = useCallback(async (mode: "wet" | "dry") => {
    if (!audioBuffer) return;
    markInteraction(lastInteractionRef);
    if (compareEngineRef.current) {
      destroyEngine(compareEngineRef.current);
      compareEngineRef.current = null;
      setComparePlayingId(null);
    }
    if (engineRef.current) {
      destroyEngine(engineRef.current);
      engineRef.current = null;
    }
    const engine = createEngine(audioBuffer);
    engineRef.current = engine;
    if (engine.ctx && engine.ctx.state !== "running") {
      await engine.ctx.resume();
    }
    const source = mode === "wet" ? connectAndPlay(engine, params) : playDry(engine);
    setIsPlaying(true);
    setPlayMode(mode);
    source.onended = () => {
      if (engineRef.current === engine) {
        destroyEngine(engine);
        engineRef.current = null;
      }
      setIsPlaying(false);
    };
  }, [audioBuffer, params]);

  const handleStop = useCallback(() => {
    markInteraction(lastInteractionRef);
    if (engineRef.current) {
      destroyEngine(engineRef.current);
      engineRef.current = null;
    }
    if (compareEngineRef.current) {
      destroyEngine(compareEngineRef.current);
      compareEngineRef.current = null;
      setComparePlayingId(null);
    }
    setIsPlaying(false);
  }, []);

  const handleCompareIterationPlay = useCallback((iteration: Tables<"sessions">) => {
    if (!audioBuffer || !iteration.effect_params) return;
    markInteraction(lastInteractionRef);
    if (compareEngineRef.current) destroyEngine(compareEngineRef.current);
    if (engineRef.current) {
      stopPlayback(engineRef.current);
      setIsPlaying(false);
    }

    const engine = createEngine(audioBuffer);
    compareEngineRef.current = engine;
    const source = connectAndPlay(engine, iteration.effect_params as unknown as EffectParams);
    setComparePlayingId(iteration.id);
    source.onended = () => {
      if (compareEngineRef.current === engine) {
        destroyEngine(engine);
        compareEngineRef.current = null;
      }
      setComparePlayingId(null);
    };
  }, [audioBuffer]);

  const handleParamsChange = useCallback((newParams: EffectParams) => {
    markInteraction(lastInteractionRef);
    setParams(newParams);
    if (engineRef.current && isPlaying && playMode === "wet") {
      applyParams(engineRef.current, newParams);
    }
  }, [isPlaying, playMode]);

  const handleSelectIteration = useCallback((iteration: Tables<"sessions">) => {
    markInteraction(lastInteractionRef);
    if (iteration.effect_params) {
      setParams(iteration.effect_params as unknown as EffectParams);
    }
    setIterationRound(iteration.iteration_round);
    setSessionId(iteration.id);
    setPrompt(iteration.prompt_text);
    if (iteration.refinement_note) setRefinementNote(iteration.refinement_note);
    setLoadedSessionLabel(`Selected Remix v${iteration.iteration_round}`);
    toast.success(`Loaded Remix v${iteration.iteration_round}`);
  }, []);

  return (
    <StudioLayout>
      <div className="px-3 sm:px-6 py-5 sm:py-8 max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Step 1: Input */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            1. Load your audio
          </h2>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 mb-3 sm:flex sm:gap-1">
            <button
              onClick={() => setInputTab("upload")}
              className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                inputTab === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileAudio className="w-4 h-4" /> Upload File
            </button>
            <button
              onClick={() => setInputTab("record")}
              className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                inputTab === "record" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mic className="w-4 h-4" /> Record Live
            </button>
          </div>

          {inputTab === "upload" ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all hover:border-primary/50 ${
                audioFile ? "border-primary/30 bg-accent/10" : "border-border"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { setInputSource("upload"); handleFileUpload(file); }
                }}
              />
              {audioFile ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">{audioFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {audioBuffer && `${audioBuffer.duration.toFixed(1)}s · ${audioBuffer.sampleRate}Hz · ${audioBuffer.numberOfChannels}ch`}
                      {inputSource === "recording" && " · Live Recording"}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Drop an audio file here or click to browse</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">WAV, MP3, FLAC, OGG supported</p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-glass rounded-2xl p-6">
              <LiveRecorder onRecordingComplete={handleRecordingComplete} />
            </div>
          )}
        </motion.section>

        {/* Step 2: Prompt */}
        <AnimatePresence>
          {(audioFile || loadedSessionLabel) && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                2. Describe your tone
              </h2>
              {loadedSessionLabel && (
                <div className="mb-3 text-xs rounded-lg bg-primary/10 text-primary px-3 py-2">
                  {loadedSessionLabel}
                </div>
              )}
              <div className="bg-glass rounded-2xl p-1 glow-primary">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-background/80 rounded-xl px-3 sm:px-4 py-3">
                  <Zap className="w-5 h-5 text-primary shrink-0" />
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    disabled={isGenerating}
                    placeholder="e.g. warm blues tone with smooth reverb"
                    className="flex-1 bg-transparent text-foreground font-mono text-xs sm:text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isGenerating}
                    className="w-full sm:w-auto shrink-0 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-40"
                  >
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {promptSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPrompt(s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={() => setGenerationMode("fresh")}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    generationMode === "fresh" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  Start From Fresh Chain
                </button>
                <button
                  onClick={() => setGenerationMode("modify")}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    generationMode === "modify" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  Modify Existing Chain
                </button>
              </div>
              {aiReasons.length > 0 && (
                <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                    AI Tone Decisions
                  </p>
                  <ul className="text-xs text-primary/90 space-y-1">
                    {aiReasons.slice(0, 5).map((reason, idx) => (
                      <li key={`${reason}-${idx}`}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Step 3: Preview & Controls */}
        <AnimatePresence>
          {isGenerated && audioBuffer && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  3. Preview & fine-tune
                </h2>
                <p className="text-xs text-secondary font-medium mb-3">
                  Active Version: Remix v{iterationRound}
                </p>

                <div className="bg-glass rounded-2xl p-4 mb-4">
                  <Waveform analyser={engineRef.current?.analyser ?? null} isPlaying={isPlaying} />
                </div>

                {/* Playback controls */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {!isPlaying ? (
                  <>
                      <button disabled={isGenerating} onClick={() => handlePlay("wet")} className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50">
                        <Play className="w-4 h-4" /> Play with Effects
                      </button>
                      <button disabled={isGenerating} onClick={() => handlePlay("dry")} className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-all disabled:opacity-50">
                        <Play className="w-4 h-4" /> Play Dry (A/B)
                      </button>
                  </>
                ) : (
                    <button disabled={isGenerating} onClick={handleStop} className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50">
                      <Square className="w-4 h-4" /> Stop
                    </button>
                )}
                  {isPlaying && (
                    <span className="text-xs font-mono text-muted-foreground">
                      Playing: {playMode === "wet" ? "With Effects" : "Dry Signal"}
                    </span>
                  )}
                </div>
              </div>

              {/* Iterative generation controls */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <button
                  onClick={() => { setShowRefine(false); toast.success("Tone saved! 🎸"); }}
                  disabled={isGenerating}
                  className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/20 text-primary font-semibold text-sm hover:bg-primary/30 transition-all border border-primary/30"
                >
                  <Check className="w-4 h-4" /> This is perfect
                </button>
                {iterationRound < 5 && (
                  <button
                    onClick={() => setShowRefine(!showRefine)}
                    disabled={isGenerating}
                    className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary/20 text-secondary font-semibold text-sm hover:bg-secondary/30 transition-all border border-secondary/30"
                  >
                    <RefreshCw className="w-4 h-4" /> Refine it ({5 - iterationRound} left)
                  </button>
                )}
                <button
                  onClick={() => { setParams(defaultParams); setIsGenerated(false); setPrompt(""); setSessionId(null); setIterations([]); setIterationRound(1); setShowRefine(false); setLoadedSessionLabel(null); }}
                  disabled={isGenerating}
                  className="w-full sm:w-auto sm:ml-auto justify-center flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>

              {/* Refinement input */}
              <AnimatePresence>
                {showRefine && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <div className="space-y-3">
                      <div className="bg-glass rounded-2xl p-1">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-background/80 rounded-xl px-3 sm:px-4 py-3">
                          <RefreshCw className="w-5 h-5 text-secondary shrink-0" />
                          <input
                            type="text"
                            value={refinementNote}
                            onChange={(e) => setRefinementNote(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRefine()}
                            disabled={isGenerating}
                            placeholder="e.g. make it more percussive, add breakdown at 0:45"
                            className="flex-1 bg-transparent text-foreground font-mono text-xs sm:text-sm outline-none placeholder:text-muted-foreground/50"
                          />
                          <button
                            onClick={handleRefine}
                            disabled={!refinementNote.trim() || isGenerating}
                            className="w-full sm:w-auto shrink-0 px-5 py-2 rounded-lg bg-secondary text-secondary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-40"
                          >
                            {isGenerating ? "Refining..." : "Refine"}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {refinementSuggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => setRefinementNote(s)}
                            className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Compare any remix version */}
              {iterations.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Compare Remix Versions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {iterations.map((iter) => (
                      <button
                        key={iter.id}
                        disabled={isGenerating}
                        onClick={() => handleCompareIterationPlay(iter)}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all text-left disabled:opacity-50 ${
                          comparePlayingId === iter.id ? "border-secondary bg-secondary/10" : "border-border hover:border-secondary/50"
                        }`}
                      >
                        <Play className="w-3 h-3 inline mr-1" />
                        Play Remix v{iter.iteration_round}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Iteration history */}
              <IterationHistory
                iterations={iterations}
                currentRound={iterationRound}
                onSelectIteration={handleSelectIteration}
              />

              {/* Effect knobs */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Fine-tune parameters
                </h3>
                <EffectKnobs params={params} onChange={handleParamsChange} />
              </div>

              {/* Value Summary */}
              <ValueSummary
                durationSeconds={audioBuffer.duration}
                params={params}
                iterationRound={iterationRound}
                mode={generationMode}
              />

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  4. Effect Chain
                </h3>
                <EffectChainSummary
                  iterations={iterations}
                  currentRound={iterationRound}
                  currentParams={params}
                />
              </div>

              {/* DAW Export */}
              <DAWExport audioBuffer={audioBuffer} fileName={audioFile?.name ?? "output"} params={params} />
            </motion.section>
          )}
        </AnimatePresence>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Growth AI Ops
          </h2>
          <GrowthAutomationSuite />
        </motion.section>
      </div>
    </StudioLayout>
  );
};

export default Studio;
