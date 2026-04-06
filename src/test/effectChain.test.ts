import { describe, expect, it } from "vitest";
import { describeEffectParams } from "@/lib/effectChain";
import { defaultParams, parsePrompt } from "@/lib/effectPresets";

describe("effect chain descriptors", () => {
  it("returns no descriptors for a dry signal", () => {
    expect(describeEffectParams(defaultParams)).toEqual([]);
  });

  it("describes active effects for a generated tone", () => {
    const params = parsePrompt("ambient ethereal space");
    const labels = describeEffectParams(params).map((effect) => effect.label);

    expect(labels).toContain("Reverb");
    expect(labels).toContain("Delay");
    expect(labels).toContain("Chorus");
    expect(labels).toContain("EQ Low");
    expect(labels).toContain("EQ High");
  });
});
