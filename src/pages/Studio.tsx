import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Play, Square, Zap, RotateCcw, Guitar } from "lucide-react";
import { parsePrompt, EffectParams, defaultParams } from "@/lib/effectPresets";
import { loadAudioFile, createEngine, connectAndPlay, playDry, stopPlayback, destroyEngine, applyParams, AudioEngineState } from "@/lib/audioEngine";
import Waveform from "@/components/studio/Waveform";
import EffectKnobs from "@/components/studio/EffectKnobs";

const promptSuggestions = [
  "warm blues tone with smooth reverb",
  "heavy metal crunch, tight low-end",
  "shoegaze dreamy wall of sound",
  "funky clean with wah and compression",
  "ambient ethereal space",
  "classic rock overdrive",
];

const Studio = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [prompt, setPrompt] = useState("");
  const [params, setParams] = useState<EffectParams>(defaultParams);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<"wet" | "dry">("wet");
  const [isGenerated, setIsGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<AudioEngineState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) destroyEngine(engineRef.current);
    };
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      if (engineRef.current) destroyEngine(engineRef.current);
      const buffer = await loadAudioFile(file);
      setAudioFile(file);
      setAudioBuffer(buffer);
      setIsGenerated(false);
      setParams(defaultParams);
    } catch {
      alert("Could not decode audio file. Please try a different file.");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    // Simulate brief processing
    setTimeout(() => {
      const newParams = parsePrompt(prompt);
      setParams(newParams);
      setIsGenerated(true);
      setIsGenerating(false);
      // If engine exists and playing, apply live
      if (engineRef.current && isPlaying) {
        applyParams(engineRef.current, newParams);
      }
    }, 600);
  }, [prompt, isPlaying]);

  const handlePlay = useCallback((mode: "wet" | "dry") => {
    if (!audioBuffer) return;
    // Stop current
    if (engineRef.current) stopPlayback(engineRef.current);

    // Create fresh engine
    const engine = createEngine(audioBuffer);
    engineRef.current = engine;

    const source = mode === "wet" ? connectAndPlay(engine, params) : playDry(engine);
    setIsPlaying(true);
    setPlayMode(mode);

    source.onended = () => {
      setIsPlaying(false);
    };
  }, [audioBuffer, params]);

  const handleStop = useCallback(() => {
    if (engineRef.current) stopPlayback(engineRef.current);
    setIsPlaying(false);
  }, []);

  const handleParamsChange = useCallback((newParams: EffectParams) => {
    setParams(newParams);
    if (engineRef.current && isPlaying && playMode === "wet") {
      applyParams(engineRef.current, newParams);
    }
  }, [isPlaying, playMode]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/50">
        <div className="container px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Guitar className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">ToneForge</span>
          </a>
          <span className="text-xs font-mono text-muted-foreground">STUDIO</span>
        </div>
      </nav>

      <main className="container px-6 pt-24 pb-16 max-w-4xl mx-auto space-y-8">
        {/* Step 1: Upload Audio */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            1. Load your audio
          </h2>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:border-primary/50 ${
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
                if (file) handleFileUpload(file);
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
        </motion.section>

        {/* Step 2: Prompt */}
        <AnimatePresence>
          {audioFile && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                2. Describe your tone
              </h2>
              <div className="bg-glass rounded-2xl p-1 glow-primary">
                <div className="flex items-center gap-3 bg-background/80 rounded-xl px-4 py-3">
                  <Zap className="w-5 h-5 text-primary shrink-0" />
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    placeholder="e.g. warm blues tone with smooth reverb"
                    className="flex-1 bg-transparent text-foreground font-mono text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isGenerating}
                    className="shrink-0 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-40"
                  >
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>

              {/* Suggestions */}
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

                {/* Waveform */}
                <div className="bg-glass rounded-2xl p-4 mb-4">
                  <Waveform
                    analyser={engineRef.current?.analyser ?? null}
                    isPlaying={isPlaying}
                  />
                </div>

                {/* Playback controls */}
                <div className="flex items-center gap-3 flex-wrap">
                  {!isPlaying ? (
                    <>
                      <button
                        onClick={() => handlePlay("wet")}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
                      >
                        <Play className="w-4 h-4" /> Play with Effects
                      </button>
                      <button
                        onClick={() => handlePlay("dry")}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-all"
                      >
                        <Play className="w-4 h-4" /> Play Dry (A/B)
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleStop}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm hover:brightness-110 transition-all"
                    >
                      <Square className="w-4 h-4" /> Stop
                    </button>
                  )}
                  {isPlaying && (
                    <span className="text-xs font-mono text-muted-foreground">
                      Playing: {playMode === "wet" ? "With Effects" : "Dry Signal"}
                    </span>
                  )}
                  <button
                    onClick={() => { setParams(defaultParams); setIsGenerated(false); setPrompt(""); }}
                    className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 text-muted-foreground text-sm hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                </div>
              </div>

              {/* Effect knobs */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Fine-tune parameters
                </h3>
                <EffectKnobs params={params} onChange={handleParamsChange} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Studio;
