import type { EffectParams } from "@/lib/effectPresets";

export interface EffectDescriptor {
  key: string;
  label: string;
  value: string;
  emphasis: "primary" | "secondary";
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function describeEffectParams(params: EffectParams): EffectDescriptor[] {
  const descriptors: EffectDescriptor[] = [];

  if (params.distortion > 0.01) {
    descriptors.push({ key: "distortion", label: "Distortion", value: percent(params.distortion), emphasis: "primary" });
  }
  if (params.overdrive > 0.01) {
    descriptors.push({ key: "overdrive", label: "Overdrive", value: percent(params.overdrive), emphasis: "primary" });
  }
  if (params.reverb > 0.01) {
    descriptors.push({ key: "reverb", label: "Reverb", value: percent(params.reverb), emphasis: "secondary" });
  }
  if (params.delay > 0.01) {
    descriptors.push({
      key: "delay",
      label: "Delay",
      value: `${percent(params.delay)} at ${params.delayTime.toFixed(2)}s`,
      emphasis: "secondary",
    });
  }
  if (params.chorus > 0.01) {
    descriptors.push({ key: "chorus", label: "Chorus", value: percent(params.chorus), emphasis: "secondary" });
  }
  if (params.compression > 0.01) {
    descriptors.push({ key: "compression", label: "Compression", value: percent(params.compression), emphasis: "secondary" });
  }
  if (Math.abs(params.eq.low) > 0) {
    descriptors.push({ key: "eq-low", label: "EQ Low", value: `${params.eq.low > 0 ? "+" : ""}${params.eq.low}dB`, emphasis: "secondary" });
  }
  if (Math.abs(params.eq.mid) > 0) {
    descriptors.push({ key: "eq-mid", label: "EQ Mid", value: `${params.eq.mid > 0 ? "+" : ""}${params.eq.mid}dB`, emphasis: "secondary" });
  }
  if (Math.abs(params.eq.high) > 0) {
    descriptors.push({ key: "eq-high", label: "EQ High", value: `${params.eq.high > 0 ? "+" : ""}${params.eq.high}dB`, emphasis: "secondary" });
  }
  if (Math.abs(params.gain - 1) > 0.01) {
    descriptors.push({ key: "gain", label: "Output Gain", value: `${params.gain.toFixed(2)}x`, emphasis: "secondary" });
  }

  return descriptors;
}
