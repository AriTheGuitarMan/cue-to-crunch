import { describe, expect, it } from "vitest";
import { isAudibleDelta, measureDryWetDelta } from "@/lib/audioQuality";

function makeSine(length = 4096, amp = 0.3, freq = 6) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / length);
  }
  return out;
}

describe("audio dry/wet regression guards", () => {
  it("flags identical dry and wet as not audible", () => {
    const dry = makeSine();
    const wet = new Float32Array(dry);
    const delta = measureDryWetDelta(dry, wet);
    expect(isAudibleDelta(delta)).toBe(false);
  });

  it("detects audible processing change", () => {
    const dry = makeSine();
    const wet = new Float32Array(dry.length);
    for (let i = 0; i < dry.length; i++) {
      // Simulate harmonic distortion + gain shift.
      wet[i] = Math.tanh(dry[i] * 3) * 0.9;
    }
    const delta = measureDryWetDelta(dry, wet);
    expect(isAudibleDelta(delta)).toBe(true);
  });
});
