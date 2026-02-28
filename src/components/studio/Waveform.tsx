import { useRef, useEffect, useCallback } from "react";

interface WaveformProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const Waveform = ({ analyser, isPlaying }: WaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = "hsl(175, 80%, 50%)";
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

    // Glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = "hsl(175, 80%, 50%)";
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (isPlaying) {
      animRef.current = requestAnimationFrame(draw);
    }
  }, [analyser, isPlaying]);

  useEffect(() => {
    if (isPlaying && analyser) {
      animRef.current = requestAnimationFrame(draw);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, analyser, draw]);

  // Draw flat line when not playing
  useEffect(() => {
    if (!isPlaying) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "hsl(220, 10%, 30%)";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={200}
      className="w-full h-32 sm:h-40 rounded-xl bg-muted/30"
    />
  );
};

export default Waveform;
