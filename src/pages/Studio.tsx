import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Play, Square, Zap, RotateCcw, Mic, FileAudio, Check, RefreshCw } from "lucide-react";
import { parsePrompt, refineParamsFromPrompt, EffectParams, defaultParams } from "@/lib/effectPresets";
import { loadAudioFile, createEngine, connectAndPlay, playDry, stopPlayback, destroyEngine, applyParams, AudioEngineState } from "@/lib/audioEngine";
import Waveform from "@/components/studio/Waveform";
import EffectKnobs from "@/components/studio/EffectKnobs";
import LiveRecorder from "@/components/studio/LiveRecorder";
import ValueSummary from "@/components/studio/ValueSummary";
import DAWExport from "@/components/studio/DAWExport";
import IterationHistory from "@/components/studio/IterationHistory";
import StudioLayout from "@/components/studio/StudioLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calculateSavings } from "@/components/studio/ValueSummary";
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
  const [previousParams, setPreviousParams] = useState<EffectParams | null>(null);
  const [comparePlaying, setComparePlaying] = useState<"current" | "previous" | null>(null);
  const [loadedSessionLabel, setLoadedSessionLabel] = useState<string | null>(null);

  const engineRef = useRef<AudioEngineState | null>(null);
  const compareEngineRef = useRef<AudioEngineState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (engineRef.current) destroyEngine(engineRef.current);
      if (compareEngineRef.current) destroyEngine(compareEngineRef.current);
    };
  }, []);

  useEffect(() => {
    const loadSessionId = searchParams.get("loadSession");
    if (!user || !loadSessionId) return;
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", loadSessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setSessionId(data.id);
        setPrompt(data.prompt_text);
        setIterationRound(data.iteration_round);
        setGenerationMode("modify");
        setIterations([data]);
        if (data.effect_params) {
          setParams(data.effect_params as unknown as EffectParams);
        }
        setLoadedSessionLabel(`Loaded session from ${new Date(data.created_at).toLocaleString()}`);
        toast.success("Generation loaded. Upload audio to continue tweaking.");
      });
  }, [searchParams, user]);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      if (engineRef.current) destroyEngine(engineRef.current);
      const buffer = await loadAudioFile(file);
      setAudioFile(file);
      setAudioBuffer(buffer);
      setIsGenerated(false);
      if (!sessionId) {
        setParams(defaultParams);
        setIterationRound(1);
        setIterations([]);
      }
      setShowRefine(false);
    } catch {
      toast.error("Could not decode audio file.");
    }
  }, [sessionId]);

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

  const saveSession = useCallback(async (
    promptText: string,
    effectParams: EffectParams,
    round: number,
    parentId: string | null,
    refNote: string | null
  ) => {
    if (!user || !audioBuffer) return null;
    const { timeSavedMinutes, moneySaved } = calculateSavings(audioBuffer.duration, {
      params: effectParams,
      iterationRound: round,
      mode: generationMode,
    });

    const { data, error } = await supabase.from("sessions").insert({
      user_id: user.id,
      prompt_text: promptText,
      refinement_note: refNote,
      input_source: inputSource,
      duration_seconds: audioBuffer.duration,
      time_saved_minutes: timeSavedMinutes,
      money_saved: moneySaved,
      iteration_round: round,
      parent_session_id: parentId,
      effect_params: effectParams,
    }).select().single();

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
        lifetime_time_saved_minutes: profile.lifetime_time_saved_minutes + timeSavedMinutes,
        lifetime_money_saved: profile.lifetime_money_saved + moneySaved,
      }).eq("user_id", user.id);
    }

    // Save to knowledge base
    const tags = promptText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    await supabase.from("knowledge_base").insert({
      user_id: user.id,
      session_id: data.id,
      summary: `${promptText}${refNote ? ` → ${refNote}` : ""}`,
      tags: tags.slice(0, 10),
    });

    return data;
  }, [user, audioBuffer, inputSource, generationMode]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    setTimeout(async () => {
      const newParams = generationMode === "modify"
        ? refineParamsFromPrompt(params, prompt)
        : parsePrompt(prompt);
      setParams(newParams);
      setIsGenerated(true);
      setIsGenerating(false);

      if (engineRef.current && isPlaying) {
        applyParams(engineRef.current, newParams);
      }

      // Save to DB
      const session = await saveSession(prompt, newParams, 1, null, null);
      if (session) {
        setSessionId(session.id);
        setIterationRound(1);
        setIterations([session]);
      }
    }, 600);
  }, [prompt, isPlaying, saveSession, generationMode, params]);

  const handleRefine = useCallback(async () => {
    if (!refinementNote.trim() || iterationRound >= 5) return;
    setIsGenerating(true);

    setTimeout(async () => {
      setPreviousParams(params);
      const newParams = refineParamsFromPrompt(params, refinementNote);
      setParams(newParams);
      setIsGenerating(false);

      const newRound = iterationRound + 1;
      setIterationRound(newRound);

      const session = await saveSession(prompt, newParams, newRound, sessionId, refinementNote);
      if (session) {
        setIterations((prev) => [...prev, session]);
        setSessionId(session.id);
      }

      setRefinementNote("");
      setShowRefine(false);

      if (engineRef.current && isPlaying) {
        applyParams(engineRef.current, newParams);
      }
    }, 600);
  }, [refinementNote, iterationRound, params, prompt, sessionId, isPlaying, saveSession]);

  const handlePlay = useCallback((mode: "wet" | "dry") => {
    if (!audioBuffer) return;
    if (engineRef.current) stopPlayback(engineRef.current);
    const engine = createEngine(audioBuffer);
    engineRef.current = engine;
    const source = mode === "wet" ? connectAndPlay(engine, params) : playDry(engine);
    setIsPlaying(true);
    setPlayMode(mode);
    source.onended = () => setIsPlaying(false);
  }, [audioBuffer, params]);

  const handleStop = useCallback(() => {
    if (engineRef.current) stopPlayback(engineRef.current);
    setIsPlaying(false);
  }, []);

  const handleComparePlay = useCallback((version: "current" | "previous") => {
    if (!audioBuffer || !previousParams) return;
    if (compareEngineRef.current) destroyEngine(compareEngineRef.current);
    if (engineRef.current) stopPlayback(engineRef.current);

    const engine = createEngine(audioBuffer);
    compareEngineRef.current = engine;
    const p = version === "current" ? params : previousParams;
    const source = connectAndPlay(engine, p);
    setComparePlaying(version);
    source.onended = () => setComparePlaying(null);
  }, [audioBuffer, params, previousParams]);

  const handleParamsChange = useCallback((newParams: EffectParams) => {
    setParams(newParams);
    if (engineRef.current && isPlaying && playMode === "wet") {
      applyParams(engineRef.current, newParams);
    }
  }, [isPlaying, playMode]);

  const handleSelectIteration = useCallback((iteration: Tables<"sessions">) => {
    if (iteration.effect_params) {
      setPreviousParams(params);
      setParams(iteration.effect_params as unknown as EffectParams);
    }
    setIterationRound(iteration.iteration_round);
    setSessionId(iteration.id);
    if (iteration.refinement_note) setRefinementNote(iteration.refinement_note);
    toast.success(`Loaded round ${iteration.iteration_round}`);
  }, [params]);

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

                <div className="bg-glass rounded-2xl p-4 mb-4">
                  <Waveform analyser={engineRef.current?.analyser ?? null} isPlaying={isPlaying} />
                </div>

                {/* Playback controls */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {!isPlaying ? (
                  <>
                      <button onClick={() => handlePlay("wet")} className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all">
                        <Play className="w-4 h-4" /> Play with Effects
                      </button>
                      <button onClick={() => handlePlay("dry")} className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-all">
                        <Play className="w-4 h-4" /> Play Dry (A/B)
                      </button>
                  </>
                ) : (
                    <button onClick={handleStop} className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm hover:brightness-110 transition-all">
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
                  className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/20 text-primary font-semibold text-sm hover:bg-primary/30 transition-all border border-primary/30"
                >
                  <Check className="w-4 h-4" /> This is perfect
                </button>
                {iterationRound < 5 && (
                  <button
                    onClick={() => setShowRefine(!showRefine)}
                    className="w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary/20 text-secondary font-semibold text-sm hover:bg-secondary/30 transition-all border border-secondary/30"
                  >
                    <RefreshCw className="w-4 h-4" /> Refine it ({5 - iterationRound} left)
                  </button>
                )}
                <button
                  onClick={() => { setParams(defaultParams); setIsGenerated(false); setPrompt(""); setSessionId(null); setIterations([]); setIterationRound(1); setShowRefine(false); setPreviousParams(null); setLoadedSessionLabel(null); }}
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

              {/* Side-by-side comparison */}
              {previousParams && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleComparePlay("previous")}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      comparePlaying === "previous" ? "border-muted-foreground bg-muted/50" : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <Play className="w-3 h-3 inline mr-1" />
                    Previous Version
                  </button>
                  <button
                    onClick={() => handleComparePlay("current")}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      comparePlaying === "current" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Play className="w-3 h-3 inline mr-1" />
                    New Version
                  </button>
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

              {/* DAW Export */}
              <DAWExport audioBuffer={audioBuffer} fileName={audioFile?.name ?? "output"} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </StudioLayout>
  );
};

export default Studio;
