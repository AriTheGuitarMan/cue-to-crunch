import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Pause, Play, RotateCcw } from "lucide-react";

interface LiveRecorderProps {
  onRecordingComplete: (file: File) => void;
}

const LiveRecorder = ({ onRecordingComplete }: LiveRecorderProps) => {
  const [state, setState] = useState<"idle" | "recording" | "paused" | "preview">("idle");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "hsl(0, 84%, 60%)";
    ctx.beginPath();
    const sliceWidth = width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (state === "recording") {
      animFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  }, [state]);

  useEffect(() => {
    if (state === "recording") {
      animFrameRef.current = requestAnimationFrame(drawWaveform);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state, drawWaveform]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("preview");
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(100);
      setState("recording");
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      alert("Microphone access denied. Please allow microphone access to record.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
      clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");
      timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const submitRecording = () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const file = new File([blob], `live-recording-${Date.now()}.webm`, { type: "audio/webm" });
    onRecordingComplete(file);
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setState("idle");
    setDuration(0);
    chunksRef.current = [];
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {/* Waveform canvas */}
      {(state === "recording" || state === "paused") && (
        <canvas
          ref={canvasRef}
          width={800}
          height={120}
          className="w-full h-20 rounded-xl bg-muted/30"
        />
      )}

      {/* Preview player */}
      {state === "preview" && audioUrl && (
        <audio controls src={audioUrl} className="w-full h-10 rounded-xl" />
      )}

      <div className="flex items-center gap-3">
        {state === "idle" && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm hover:brightness-110 transition-all"
          >
            <Mic className="w-4 h-4" /> Record
          </button>
        )}

        {state === "recording" && (
          <>
            <button
              onClick={pauseRecording}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-sm"
            >
              <Pause className="w-4 h-4" /> Pause
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm"
            >
              <Square className="w-4 h-4" /> Stop
            </button>
            <span className="font-mono text-sm text-destructive animate-pulse">
              ● REC {formatTime(duration)}
            </span>
          </>
        )}

        {state === "paused" && (
          <>
            <button
              onClick={resumeRecording}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
            >
              <Play className="w-4 h-4" /> Resume
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm"
            >
              <Square className="w-4 h-4" /> Stop
            </button>
            <span className="font-mono text-sm text-muted-foreground">
              ⏸ {formatTime(duration)}
            </span>
          </>
        )}

        {state === "preview" && (
          <>
            <button
              onClick={submitRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all"
            >
              Use Recording
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-record
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LiveRecorder;
