import { useState } from "react";
import { Download, ChevronDown, Info } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import type { EffectParams } from "@/lib/effectPresets";
import { renderProcessedBuffer } from "@/lib/audioEngine";
import { audioBufferToWav } from "@/lib/audioEncoding";

interface DAWExportProps {
  audioBuffer: AudioBuffer;
  fileName: string;
  params?: EffectParams;
}

const DAWExport = ({ audioBuffer, fileName, params }: DAWExportProps) => {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const exportForDAW = async (daw: "ableton" | "logic" | "protools") => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(1);
    try {
      const sourceBuffer = params ? await renderProcessedBuffer(audioBuffer, params) : audioBuffer;
      const wav = await audioBufferToWav(sourceBuffer, setExportProgress);
      const zip = new JSZip();
      const baseName = fileName.replace(/\.[^.]+$/, "");

      if (daw === "ableton") {
        zip.file(`${baseName}.wav`, wav);
        zip.file("README.txt", `ToneForge Export for Ableton Live\n\n1. Unzip this file\n2. Open Ableton Live\n3. Drag the .wav file onto an Audio Track\n4. The audio is 24-bit / ${audioBuffer.sampleRate}Hz\n\nBPM detection: Use Ableton's built-in warp engine.`);
        setGuide("Drop the .wav file onto an Audio Track in Ableton Live.");
      } else if (daw === "logic") {
        const folder = zip.folder(`${baseName} Logic Project`);
        const media = folder!.folder("Media");
        media!.file(`${baseName}.wav`, wav);
        folder!.file("README.txt", `ToneForge Export for Logic Pro\n\n1. Open Logic Pro\n2. Create a new project or open existing\n3. Import the .wav from the Media folder\n4. Audio is 24-bit / ${audioBuffer.sampleRate}Hz`);
        setGuide("Open the Logic folder and import the WAV from the Media subfolder.");
      } else {
        const folder = zip.folder(`${baseName} PT Session`);
        const audioFiles = folder!.folder("Audio Files");
        audioFiles!.file(`${baseName}.wav`, wav);
        folder!.file("README.txt", `ToneForge Export for Pro Tools\n\n1. Open Pro Tools\n2. Use File > Import > Session Data or drag the WAV\n3. Audio is 24-bit BWF / ${audioBuffer.sampleRate}Hz`);
        setGuide("Import the session folder or drag the WAV from Audio Files into Pro Tools.");
      }

      setExportProgress(99);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-${daw}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded for ${daw === "ableton" ? "Ableton" : daw === "logic" ? "Logic Pro" : "Pro Tools"}`);
    } catch (error) {
      console.error("DAW export failed:", error);
      toast.error("Export failed. Try a shorter file or retry.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isExporting}
        className="w-full sm:w-auto flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-all disabled:opacity-60"
      >
        <Download className="w-4 h-4" />
        {isExporting ? `Exporting... ${exportProgress}%` : "Export to DAW"}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !isExporting && (
        <div className="absolute top-full mt-2 left-0 z-50 w-[min(16rem,calc(100vw-2rem))] bg-card border border-border rounded-xl shadow-lg p-1 space-y-0.5">
          {[
            { key: "ableton" as const, label: "Ableton Live", desc: "24-bit WAV + project template" },
            { key: "logic" as const, label: "Logic Pro", desc: "WAV + Logic folder structure" },
            { key: "protools" as const, label: "Pro Tools", desc: "BWF WAV + session stub" },
          ].map((daw) => (
            <button
              key={daw.key}
              onClick={() => { exportForDAW(daw.key); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{daw.label}</span>
              <span className="block text-[10px] text-muted-foreground">{daw.desc}</span>
            </button>
          ))}
          <div className="px-3 py-2 border-t border-border mt-1">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3" />
              ReWire / AAX / AU plugin sync — Coming Soon (v3)
            </p>
          </div>
        </div>
      )}

      {guide && (
        <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          💡 {guide}
        </p>
      )}
    </div>
  );
};

export default DAWExport;
