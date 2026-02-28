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
