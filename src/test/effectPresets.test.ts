import { describe, expect, it } from "vitest";
import { defaultParams, parsePrompt, refineParamsFromPrompt } from "@/lib/effectPresets";

describe("effect preset parsing", () => {
  it("maps heavy crunch prompt to clearly non-dry settings", () => {
    const params = parsePrompt("heavy metal crunch, tight low-end");
    const effectSum =
      params.distortion +
      params.overdrive +
      params.reverb +
      params.delay +
      params.chorus +
      params.compression;

    expect(effectSum).toBeGreaterThan(0.5);
    expect(params.gain).toBeGreaterThanOrEqual(1);
  });

  it("refinement prompt adjusts from defaults", () => {
    const refined = refineParamsFromPrompt(defaultParams, "more distortion and reverb");
    expect(refined.distortion).toBeGreaterThan(defaultParams.distortion);
    expect(refined.reverb).toBeGreaterThan(defaultParams.reverb);
  });
});
