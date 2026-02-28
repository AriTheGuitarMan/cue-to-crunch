import { EffectParams } from "@/lib/effectPresets";
import { Slider } from "@/components/ui/slider";

interface EffectKnobsProps {
  params: EffectParams;
  onChange: (params: EffectParams) => void;
}

const knobs: { key: keyof Omit<EffectParams, "eq" | "delayTime" | "gain">; label: string }[] = [
  { key: "distortion", label: "Distortion" },
  { key: "overdrive", label: "Overdrive" },
  { key: "reverb", label: "Reverb" },
  { key: "delay", label: "Delay" },
  { key: "chorus", label: "Chorus" },
  { key: "compression", label: "Compression" },
];

const EffectKnobs = ({ params, onChange }: EffectKnobsProps) => {
  const update = (key: string, value: number) => {
    if (key === "eqLow") onChange({ ...params, eq: { ...params.eq, low: value } });
    else if (key === "eqMid") onChange({ ...params, eq: { ...params.eq, mid: value } });
    else if (key === "eqHigh") onChange({ ...params, eq: { ...params.eq, high: value } });
    else onChange({ ...params, [key]: value });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {knobs.map(({ key, label }) => (
        <div key={key} className="bg-glass rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className="text-xs font-mono text-primary">{Math.round((params[key] as number) * 100)}%</span>
          </div>
          <Slider
            value={[params[key] as number]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v]) => update(key, v)}
            className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_.range]:bg-primary"
          />
        </div>
      ))}

      {/* EQ controls */}
      {(["low", "mid", "high"] as const).map((band) => (
        <div key={band} className="bg-glass rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">EQ {band}</span>
            <span className="text-xs font-mono text-secondary">{params.eq[band] > 0 ? "+" : ""}{params.eq[band]}dB</span>
          </div>
          <Slider
            value={[params.eq[band]]}
            min={-12}
            max={12}
            step={1}
            onValueChange={([v]) => update(`eq${band.charAt(0).toUpperCase() + band.slice(1)}`, v)}
            className="[&_[role=slider]]:bg-secondary [&_[role=slider]]:border-secondary [&_.range]:bg-secondary"
          />
        </div>
      ))}
    </div>
  );
};

export default EffectKnobs;
