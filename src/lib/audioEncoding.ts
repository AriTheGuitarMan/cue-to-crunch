type AudioBufferLike = Pick<AudioBuffer, "numberOfChannels" | "sampleRate" | "length" | "getChannelData">;

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function nextTick() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function audioBufferToWav(
  buffer: AudioBufferLike,
  onProgress?: (progress: number) => void,
): Promise<ArrayBuffer> {
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

  writeString(view, 0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const chunkSize = 8192;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const intSample = Math.floor(sample * 8388607);
      view.setUint8(offset, intSample & 0xff);
      view.setUint8(offset + 1, (intSample >> 8) & 0xff);
      view.setUint8(offset + 2, (intSample >> 16) & 0xff);
      offset += 3;
    }

    if (i % chunkSize === 0) {
      onProgress?.(Math.min(95, Math.round((i / length) * 95)));
      await nextTick();
    }
  }

  onProgress?.(100);
  return wav;
}

export async function audioBufferToWavBlob(
  buffer: AudioBufferLike,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  const wav = await audioBufferToWav(buffer, onProgress);
  return new Blob([wav], { type: "audio/wav" });
}
