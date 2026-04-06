import { describe, expect, it } from "vitest";
import { audioBufferToWav } from "@/lib/audioEncoding";

function makeBuffer(length = 64) {
  const channel = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    channel[i] = Math.sin((2 * Math.PI * i) / length) * 0.25;
  }

  return {
    numberOfChannels: 1,
    sampleRate: 44100,
    length,
    getChannelData: () => channel,
  };
}

describe("audio encoding", () => {
  it("writes a valid RIFF/WAVE header", async () => {
    const wav = await audioBufferToWav(makeBuffer(128));
    const view = new DataView(wav);
    const header = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );
    const format = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    );

    expect(header).toBe("RIFF");
    expect(format).toBe("WAVE");
    expect(wav.byteLength).toBe(44 + 128 * 3);
  });

  it("reports encoding progress through completion", async () => {
    const progress: number[] = [];
    await audioBufferToWav(makeBuffer(16384), (value) => {
      progress.push(value);
    });

    expect(progress.length).toBeGreaterThan(1);
    expect(progress.at(-1)).toBe(100);
  });
});
