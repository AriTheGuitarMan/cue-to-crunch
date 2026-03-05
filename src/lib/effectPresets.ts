// Audio effect presets mapped to natural language keywords
export interface EffectParams {
  distortion: number;    // 0-1
  reverb: number;        // 0-1
  delay: number;         // 0-1
  delayTime: number;     // seconds
  chorus: number;        // 0-1
  eq: { low: number; mid: number; high: number }; // -12 to 12 dB
  compression: number;   // 0-1
  overdrive: number;     // 0-1
  gain: number;          // 0.5-2
}

export const defaultParams: EffectParams = {
  distortion: 0,
  reverb: 0,
  delay: 0,
  delayTime: 0.3,
  chorus: 0,
  eq: { low: 0, mid: 0, high: 0 },
  compression: 0,
  overdrive: 0,
  gain: 1,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface PromptMatch {
  keywords: string[];
  params: Partial<EffectParams>;
}

const presets: PromptMatch[] = [
  {
    keywords: ["warm", "blues", "smooth"],
    params: { overdrive: 0.3, reverb: 0.4, eq: { low: 4, mid: 2, high: -2 }, compression: 0.3 },
  },
  {
    keywords: ["heavy", "metal", "crunch", "aggressive"],
    params: { distortion: 0.8, compression: 0.6, eq: { low: 6, mid: 4, high: 2 }, gain: 1.4 },
  },
  {
    keywords: ["shoegaze", "dreamy", "wall"],
    params: { reverb: 0.9, delay: 0.6, delayTime: 0.4, chorus: 0.7, distortion: 0.3 },
  },
  {
    keywords: ["funky", "clean", "wah"],
    params: { compression: 0.5, eq: { low: -2, mid: 6, high: 4 }, chorus: 0.3 },
  },
  {
    keywords: ["lo-fi", "indie", "jangle"],
    params: { chorus: 0.5, reverb: 0.3, eq: { low: -4, mid: 0, high: -6 }, compression: 0.4 },
  },
  {
    keywords: ["ambient", "ethereal", "spacey", "space"],
    params: { reverb: 0.95, delay: 0.7, delayTime: 0.5, chorus: 0.4, eq: { low: 2, mid: -2, high: 4 } },
  },
  {
    keywords: ["rock", "classic", "vintage"],
    params: { overdrive: 0.5, reverb: 0.3, compression: 0.4, eq: { low: 2, mid: 4, high: 0 } },
  },
  {
    keywords: ["jazz", "mellow", "soft"],
    params: { reverb: 0.35, eq: { low: 2, mid: 0, high: -4 }, compression: 0.2, chorus: 0.15 },
  },
  {
    keywords: ["fuzz", "psychedelic", "stoner"],
    params: { distortion: 0.9, overdrive: 0.6, reverb: 0.4, eq: { low: 6, mid: 2, high: -2 } },
  },
  {
    keywords: ["bright", "sparkle", "twang", "country"],
    params: { eq: { low: -2, mid: 0, high: 8 }, compression: 0.5, reverb: 0.2, delay: 0.15 },
  },
  {
    keywords: ["distortion", "distorted", "heavy"],
    params: { distortion: 0.7, gain: 1.3 },
  },
  {
    keywords: ["reverb", "echo", "hall"],
    params: { reverb: 0.7 },
  },
  {
    keywords: ["delay", "repeat"],
    params: { delay: 0.5, delayTime: 0.35 },
  },
  {
    keywords: ["chorus"],
    params: { chorus: 0.6 },
  },
  {
    keywords: ["compression", "compressed", "tight"],
    params: { compression: 0.6 },
  },
  {
    keywords: ["overdrive", "driven", "crunchy"],
    params: { overdrive: 0.5 },
  },
];

export function parsePrompt(prompt: string): EffectParams {
  const lower = prompt.toLowerCase();
  const result = { ...defaultParams, eq: { ...defaultParams.eq } };
  let matchCount = 0;

  for (const preset of presets) {
    const matched = preset.keywords.some((kw) => lower.includes(kw));
    if (matched) {
      matchCount++;
      const p = preset.params;
      if (p.distortion !== undefined) result.distortion = Math.max(result.distortion, p.distortion);
      if (p.reverb !== undefined) result.reverb = Math.max(result.reverb, p.reverb);
      if (p.delay !== undefined) result.delay = Math.max(result.delay, p.delay);
      if (p.delayTime !== undefined) result.delayTime = p.delayTime;
      if (p.chorus !== undefined) result.chorus = Math.max(result.chorus, p.chorus);
      if (p.compression !== undefined) result.compression = Math.max(result.compression, p.compression);
      if (p.overdrive !== undefined) result.overdrive = Math.max(result.overdrive, p.overdrive);
      if (p.gain !== undefined) result.gain = Math.max(result.gain, p.gain);
      if (p.eq) {
        result.eq.low = Math.max(result.eq.low, p.eq.low);
        result.eq.mid = Math.max(result.eq.mid, p.eq.mid);
        result.eq.high = Math.max(result.eq.high, p.eq.high);
      }
    }
  }

  // If no matches, give a gentle default
  if (matchCount === 0) {
    result.reverb = 0.3;
    result.compression = 0.2;
  }

  return result;
}

export function refineParamsFromPrompt(baseParams: EffectParams, prompt: string): EffectParams {
  const lower = prompt.toLowerCase();
  const next: EffectParams = {
    ...baseParams,
    eq: { ...baseParams.eq },
  };

  const hasMore = /\b(more|boost|increase|stronger|heavier|wider|bigger)\b/.test(lower);
  const hasLess = /\b(less|reduce|decrease|softer|lighter|tighter|drier)\b/.test(lower);
  const direction = hasMore && !hasLess ? 1 : hasLess && !hasMore ? -1 : 0;

  const step = {
    amount: 0.12,
    eq: 1.8,
    delayTime: 0.05,
    gain: 0.08,
  };

  const adjust = (value: number, min: number, max: number, amount: number) =>
    clamp(value + (direction === 0 ? amount : amount * direction), min, max);

  if (/\b(distortion|fuzz|grit|saturation)\b/.test(lower)) {
    next.distortion = adjust(next.distortion, 0, 1, step.amount);
  }
  if (/\b(reverb|space|room|hall|wet)\b/.test(lower)) {
    next.reverb = adjust(next.reverb, 0, 1, step.amount);
  }
  if (/\b(delay|echo|repeat|slap)\b/.test(lower)) {
    next.delay = adjust(next.delay, 0, 1, step.amount);
    next.delayTime = adjust(next.delayTime, 0.05, 1.2, step.delayTime);
  }
  if (/\b(chorus|width|stereo)\b/.test(lower)) {
    next.chorus = adjust(next.chorus, 0, 1, step.amount);
  }
  if (/\b(compression|punch|tight)\b/.test(lower)) {
    next.compression = adjust(next.compression, 0, 1, step.amount);
  }
  if (/\b(overdrive|drive|crunch)\b/.test(lower)) {
    next.overdrive = adjust(next.overdrive, 0, 1, step.amount);
  }
  if (/\b(bright|highs|treble|sparkle)\b/.test(lower)) {
    next.eq.high = adjust(next.eq.high, -12, 12, step.eq);
  }
  if (/\b(mids|presence|vocal)\b/.test(lower)) {
    next.eq.mid = adjust(next.eq.mid, -12, 12, step.eq);
  }
  if (/\b(low|bass|sub|bottom)\b/.test(lower)) {
    next.eq.low = adjust(next.eq.low, -12, 12, step.eq);
  }
  if (/\b(volume|loud|gain)\b/.test(lower)) {
    next.gain = adjust(next.gain, 0.5, 2, step.gain);
  }

  if (/\b(dry)\b/.test(lower)) {
    next.reverb = clamp(next.reverb - step.amount, 0, 1);
    next.delay = clamp(next.delay - step.amount, 0, 1);
  }
  if (/\b(clean|cleaner)\b/.test(lower)) {
    next.distortion = clamp(next.distortion - step.amount, 0, 1);
    next.overdrive = clamp(next.overdrive - step.amount, 0, 1);
  }

  return next;
}
