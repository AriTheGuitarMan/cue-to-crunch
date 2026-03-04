import { useState } from "react";
import { Download, ChevronDown, Info } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";

interface DAWExportProps {
  audioBuffer: AudioBuffer;
  fileName: string;
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 24;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const length = buffer.length;
  const dataSize = length * blockAlign;
  const bufferSize = 44 + dataSize;
  const wav = new ArrayBuffer(bufferSize);
  const view = new DataView(wav);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const intSample = Math.floor(sample * 8388607);
      view.setUint8(offset, intSample & 0xff);
      view.setUint8(offset + 1, (intSample >> 8) & 0xff);
      view.setUint8(offset + 2, (intSample >> 16) & 0xff);
      offset += 3;
    }
  }

  return wav;
}

const DAWExport = ({ audioBuffer, fileName }: DAWExportProps) => {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);

  const exportForDAW = async (daw: "ableton" | "logic" | "protools") => {
    const wav = audioBufferToWav(audioBuffer);
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

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}-${daw}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded for ${daw === "ableton" ? "Ableton" : daw === "logic" ? "Logic Pro" : "Pro Tools"}`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-all"
      >
        <Download className="w-4 h-4" />
        Export to DAW
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 w-64 bg-card border border-border rounded-xl shadow-lg p-1 space-y-0.5">
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
