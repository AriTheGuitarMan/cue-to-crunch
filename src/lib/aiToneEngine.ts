import type { EffectParams } from "./effectPresets";

export interface SourceAudioProfile {
  rms: number;
  crestFactor: number;
  brightness: number;
}

export interface AiToneResult {
  params: EffectParams;
  reasons: string[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function similarity(a: string, b: string) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const token of ta) {
    if (tb.has(token)) overlap++;
  }
  return overlap / Math.max(ta.size, tb.size);
}

function mergeParams(base: EffectParams, incoming: Partial<EffectParams>): EffectParams {
  return {
    ...base,
    ...incoming,
    eq: {
      low: incoming.eq?.low ?? base.eq.low,
      mid: incoming.eq?.mid ?? base.eq.mid,
      high: incoming.eq?.high ?? base.eq.high,
    },
  };
}

function parseNumberControl(prompt: string, current: EffectParams): Partial<EffectParams> {
  const lower = prompt.toLowerCase();
  const out: Partial<EffectParams> = {};

  const readPercent = (name: string) => {
    const m = lower.match(new RegExp(`${name}\\s*[:=]?\\s*(\\d{1,3})\\s*%?`));
    if (!m) return null;
    return clamp(Number(m[1]) / 100, 0, 1);
  };

  const readDb = (name: string) => {
    const m = lower.match(new RegExp(`${name}\\s*[:=]?\\s*([+-]?\\d{1,2})\\s*d?b?`));
    if (!m) return null;
    return clamp(Number(m[1]), -12, 12);
  };

  const readFloat = (name: string) => {
    const m = lower.match(new RegExp(`${name}\\s*[:=]?\\s*([0-9]+(?:\\.[0-9]+)?)`));
    if (!m) return null;
    return Number(m[1]);
  };

  const distortion = readPercent("distortion");
  if (distortion !== null) out.distortion = distortion;
  const overdrive = readPercent("overdrive|drive");
  if (overdrive !== null) out.overdrive = overdrive;
  const reverb = readPercent("reverb");
  if (reverb !== null) out.reverb = reverb;
  const delay = readPercent("delay");
  if (delay !== null) out.delay = delay;
  const chorus = readPercent("chorus");
  if (chorus !== null) out.chorus = chorus;
  const compression = readPercent("compression|comp");
  if (compression !== null) out.compression = compression;

  const gain = readFloat("gain|volume");
  if (gain !== null && !Number.isNaN(gain)) out.gain = clamp(gain, 0.5, 2);
  const delayTime = readFloat("delay\\s*time");
  if (delayTime !== null && !Number.isNaN(delayTime)) out.delayTime = clamp(delayTime, 0.05, 1.2);

  const low = readDb("low|bass");
  const mid = readDb("mid|mids");
  const high = readDb("high|treble");
  if (low !== null || mid !== null || high !== null) {
    out.eq = {
      low: low ?? current.eq.low,
      mid: mid ?? current.eq.mid,
      high: high ?? current.eq.high,
    };
  }

  return out;
}

export function analyzeSourceAudio(buffer: AudioBuffer): SourceAudioProfile {
  const channel = buffer.getChannelData(0);
  let sumSq = 0;
  let peak = 0;
  let diffSum = 0;
  for (let i = 1; i < channel.length; i++) {
    const v = Math.abs(channel[i]);
    sumSq += channel[i] * channel[i];
    if (v > peak) peak = v;
    diffSum += Math.abs(channel[i] - channel[i - 1]);
  }
  const rms = Math.sqrt(sumSq / Math.max(channel.length, 1));
  const crestFactor = peak / Math.max(rms, 1e-6);
  const brightness = clamp((diffSum / Math.max(channel.length, 1)) * 10, 0, 1);
  return { rms, crestFactor, brightness };
}

export function applyAiToneStrategy(args: {
  prompt: string;
  startingParams: EffectParams;
  parsedParams: EffectParams;
  history: Array<{ prompt: string; effectParams: EffectParams }>;
  sourceProfile?: SourceAudioProfile | null;
}): AiToneResult {
  const reasons: string[] = [];
  let params = { ...args.parsedParams, eq: { ...args.parsedParams.eq } };
  const prompt = args.prompt.toLowerCase();

  // 1) AI numeric/explicit controls
  const numeric = parseNumberControl(prompt, params);
  if (Object.keys(numeric).length > 0) {
    params = mergeParams(params, numeric);
    reasons.push("Applied explicit numeric controls from prompt.");
  }

  // 2) Knowledge-guided blend from similar history prompts
  if (args.history.length > 0) {
    const ranked = args.history
      .map((h) => ({ ...h, score: similarity(args.prompt, h.prompt) }))
      .filter((h) => h.score > 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    if (ranked.length > 0) {
      const ref = ranked[0].effectParams;
      const blend = 0.18 + ranked[0].score * 0.2;
      params = {
        ...params,
        distortion: clamp(params.distortion * (1 - blend) + ref.distortion * blend, 0, 1),
        reverb: clamp(params.reverb * (1 - blend) + ref.reverb * blend, 0, 1),
        delay: clamp(params.delay * (1 - blend) + ref.delay * blend, 0, 1),
        chorus: clamp(params.chorus * (1 - blend) + ref.chorus * blend, 0, 1),
        compression: clamp(params.compression * (1 - blend) + ref.compression * blend, 0, 1),
        overdrive: clamp(params.overdrive * (1 - blend) + ref.overdrive * blend, 0, 1),
        gain: clamp(params.gain * (1 - blend) + ref.gain * blend, 0.5, 2),
        eq: {
          low: clamp(params.eq.low * (1 - blend) + ref.eq.low * blend, -12, 12),
          mid: clamp(params.eq.mid * (1 - blend) + ref.eq.mid * blend, -12, 12),
          high: clamp(params.eq.high * (1 - blend) + ref.eq.high * blend, -12, 12),
        },
      };
      reasons.push("Blended with similar successful past remix settings.");
    }
  }

  // 3) Source-aware adaptation
  if (args.sourceProfile) {
    if (args.sourceProfile.brightness > 0.62) {
      params.eq.high = clamp(params.eq.high - 1.5, -12, 12);
      reasons.push("Source-aware adaptation: reduced highs for bright input.");
    } else if (args.sourceProfile.brightness < 0.28) {
      params.eq.high = clamp(params.eq.high + 1.5, -12, 12);
      reasons.push("Source-aware adaptation: added highs for darker input.");
    }
    if (args.sourceProfile.crestFactor > 10) {
      params.compression = clamp(params.compression + 0.1, 0, 1);
      reasons.push("Source-aware adaptation: increased compression for transient-heavy signal.");
    }
  }

  // 4) Prompt intent guardrails
  if (/\b(aggressive|hard|heavy|punchy)\b/.test(prompt)) {
    params.distortion = clamp(params.distortion + 0.08, 0, 1);
    params.overdrive = clamp(params.overdrive + 0.08, 0, 1);
    params.eq.mid = clamp(params.eq.mid + 1, -12, 12);
    reasons.push("Intent boost: emphasized aggression/punch.");
  }
  if (/\b(clean|subtle|minimal|transparent)\b/.test(prompt)) {
    params.distortion = clamp(params.distortion - 0.1, 0, 1);
    params.overdrive = clamp(params.overdrive - 0.1, 0, 1);
    reasons.push("Intent cleanup: reduced distortion/drive for cleaner tone.");
  }

  // 5) Quality guardrail
  if (params.gain > 1.6) {
    params.gain = 1.6;
    params.compression = clamp(params.compression + 0.06, 0, 1);
    reasons.push("Safety guardrail: prevented clipping by limiting gain.");
  }

  // Ensure change from starting params for non-empty prompts
  const changed = JSON.stringify(params) !== JSON.stringify(args.startingParams);
  if (!changed && args.prompt.trim()) {
    params.reverb = clamp(params.reverb + 0.08, 0, 1);
    params.compression = clamp(params.compression + 0.06, 0, 1);
    reasons.push("Applied baseline AI variation to guarantee audible change.");
  }

  return { params, reasons };
}
