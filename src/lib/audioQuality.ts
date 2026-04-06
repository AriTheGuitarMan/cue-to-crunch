export interface DryWetDelta {
  energyDelta: number;
  spectralDelta: number;
  rmsDry: number;
  rmsWet: number;
}

function rms(signal: Float32Array) {
  let sum = 0;
  for (let i = 0; i < signal.length; i++) sum += signal[i] * signal[i];
  return Math.sqrt(sum / Math.max(signal.length, 1));
}

function firstDifferenceEnergy(signal: Float32Array) {
  let sum = 0;
  for (let i = 1; i < signal.length; i++) {
    const d = signal[i] - signal[i - 1];
    sum += d * d;
  }
  return Math.sqrt(sum / Math.max(signal.length - 1, 1));
}

export function measureDryWetDelta(dry: Float32Array, wet: Float32Array): DryWetDelta {
  const rmsDry = rms(dry);
  const rmsWet = rms(wet);
  const diffEnergy = firstDifferenceEnergy(wet) - firstDifferenceEnergy(dry);
  return {
    energyDelta: Math.abs(rmsWet - rmsDry),
    spectralDelta: Math.abs(diffEnergy),
    rmsDry,
    rmsWet,
  };
}

export function isAudibleDelta(delta: DryWetDelta, thresholds = { energy: 0.004, spectral: 0.003 }) {
  return delta.energyDelta >= thresholds.energy || delta.spectralDelta >= thresholds.spectral;
}

export function extractMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}
