import { EffectParams } from "./effectPresets";

export interface AudioEngineState {
  ctx: AudioContext;
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer;
  // Effect nodes
  distortion: WaveShaperNode;
  distortionGain: GainNode;
  reverbConvolver: ConvolverNode;
  reverbGain: GainNode;
  reverbDry: GainNode;
  delayNode: DelayNode;
  delayFeedback: GainNode;
  delayGain: GainNode;
  delayDry: GainNode;
  chorusDelay: DelayNode;
  chorusLfo: OscillatorNode;
  chorusLfoGain: GainNode;
  chorusGain: GainNode;
  chorusDry: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  overdrive: WaveShaperNode;
  overdriveGain: GainNode;
  masterGain: GainNode;
  analyser: AnalyserNode;
}

function makeDistortionCurve(amount: number): Float32Array {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = amount * 100;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function createImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();
  return audioBuffer;
}

export function createEngine(buffer: AudioBuffer): AudioEngineState {
  const ctx = new AudioContext();

  // Create all nodes
  const distortion = ctx.createWaveShaper();
  distortion.oversample = "4x";
  const distortionGain = ctx.createGain();

  const reverbConvolver = ctx.createConvolver();
  reverbConvolver.buffer = createImpulseResponse(ctx, 2.5, 3);
  const reverbGain = ctx.createGain();
  const reverbDry = ctx.createGain();

  const delayNode = ctx.createDelay(2);
  const delayFeedback = ctx.createGain();
  const delayGain = ctx.createGain();
  const delayDry = ctx.createGain();

  const chorusDelay = ctx.createDelay(0.05);
  const chorusLfo = ctx.createOscillator();
  const chorusLfoGain = ctx.createGain();
  const chorusGain = ctx.createGain();
  const chorusDry = ctx.createGain();
  chorusLfo.frequency.value = 1.5;
  chorusLfo.start();

  const eqLow = ctx.createBiquadFilter();
  eqLow.type = "lowshelf";
  eqLow.frequency.value = 320;

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = "peaking";
  eqMid.frequency.value = 1000;
  eqMid.Q.value = 1;

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = "highshelf";
  eqHigh.frequency.value = 3200;

  const compressor = ctx.createDynamicsCompressor();
  const overdrive = ctx.createWaveShaper();
  overdrive.oversample = "4x";
  const overdriveGain = ctx.createGain();

  const masterGain = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;

  return {
    ctx, source: null, buffer,
    distortion, distortionGain,
    reverbConvolver, reverbGain, reverbDry,
    delayNode, delayFeedback, delayGain, delayDry,
    chorusDelay, chorusLfo, chorusLfoGain, chorusGain, chorusDry,
    eqLow, eqMid, eqHigh,
    compressor, overdrive, overdriveGain,
    masterGain, analyser,
  };
}

export function applyParams(engine: AudioEngineState, params: EffectParams) {
  const { ctx } = engine;
  const now = ctx.currentTime;

  // Distortion
  if (params.distortion > 0) {
    engine.distortion.curve = makeDistortionCurve(params.distortion) as any;
    engine.distortionGain.gain.setValueAtTime(params.distortion, now);
  } else {
    engine.distortion.curve = null;
    engine.distortionGain.gain.setValueAtTime(0, now);
  }

  // Reverb
  engine.reverbGain.gain.setValueAtTime(params.reverb, now);
  engine.reverbDry.gain.setValueAtTime(1 - params.reverb * 0.5, now);

  // Delay
  engine.delayNode.delayTime.setValueAtTime(params.delayTime, now);
  engine.delayFeedback.gain.setValueAtTime(params.delay * 0.6, now);
  engine.delayGain.gain.setValueAtTime(params.delay, now);
  engine.delayDry.gain.setValueAtTime(1, now);

  // Chorus
  engine.chorusLfoGain.gain.setValueAtTime(params.chorus * 0.005, now);
  engine.chorusGain.gain.setValueAtTime(params.chorus, now);
  engine.chorusDry.gain.setValueAtTime(1, now);

  // EQ
  engine.eqLow.gain.setValueAtTime(params.eq.low, now);
  engine.eqMid.gain.setValueAtTime(params.eq.mid, now);
  engine.eqHigh.gain.setValueAtTime(params.eq.high, now);

  // Compression
  engine.compressor.threshold.setValueAtTime(-24 * params.compression, now);
  engine.compressor.ratio.setValueAtTime(1 + params.compression * 11, now);

  // Overdrive
  if (params.overdrive > 0) {
    engine.overdrive.curve = makeDistortionCurve(params.overdrive * 0.5) as any;
    engine.overdriveGain.gain.setValueAtTime(params.overdrive, now);
  } else {
    engine.overdrive.curve = null;
    engine.overdriveGain.gain.setValueAtTime(0, now);
  }

  engine.masterGain.gain.setValueAtTime(params.gain, now);
}

export function connectAndPlay(engine: AudioEngineState, params: EffectParams, startTime = 0) {
  stopPlayback(engine);

  const source = engine.ctx.createBufferSource();
  source.buffer = engine.buffer;
  engine.source = source;

  applyParams(engine, params);

  // Signal chain: source -> overdrive -> distortion -> EQ -> compressor -> chorus -> delay -> reverb -> master -> analyser -> output
  source.connect(engine.overdrive);
  engine.overdrive.connect(engine.distortion);
  engine.distortion.connect(engine.eqLow);
  engine.eqLow.connect(engine.eqMid);
  engine.eqMid.connect(engine.eqHigh);
  engine.eqHigh.connect(engine.compressor);

  // Chorus (parallel)
  engine.compressor.connect(engine.chorusDry);
  engine.compressor.connect(engine.chorusDelay);
  engine.chorusLfo.connect(engine.chorusLfoGain);
  engine.chorusLfoGain.connect(engine.chorusDelay.delayTime);
  engine.chorusDelay.connect(engine.chorusGain);
  engine.chorusDry.connect(engine.delayDry);
  engine.chorusGain.connect(engine.delayDry);

  // Delay (parallel)
  engine.delayDry.connect(engine.delayNode);
  engine.delayNode.connect(engine.delayFeedback);
  engine.delayFeedback.connect(engine.delayNode);
  engine.delayNode.connect(engine.delayGain);
  engine.delayDry.connect(engine.reverbDry);
  engine.delayGain.connect(engine.reverbDry);

  // Reverb (parallel)
  engine.reverbDry.connect(engine.reverbConvolver);
  engine.reverbConvolver.connect(engine.reverbGain);
  engine.reverbDry.connect(engine.masterGain);
  engine.reverbGain.connect(engine.masterGain);

  engine.masterGain.connect(engine.analyser);
  engine.analyser.connect(engine.ctx.destination);

  source.start(0, startTime);
  return source;
}

export function playDry(engine: AudioEngineState, startTime = 0) {
  stopPlayback(engine);
  const source = engine.ctx.createBufferSource();
  source.buffer = engine.buffer;
  engine.source = source;
  source.connect(engine.analyser);
  engine.analyser.connect(engine.ctx.destination);
  source.start(0, startTime);
  return source;
}

export function stopPlayback(engine: AudioEngineState) {
  if (engine.source) {
    try { engine.source.stop(); } catch {}
    engine.source.disconnect();
    engine.source = null;
  }
  // Disconnect everything to prevent double-connections
  try {
    engine.overdrive.disconnect();
    engine.distortion.disconnect();
    engine.eqLow.disconnect();
    engine.eqMid.disconnect();
    engine.eqHigh.disconnect();
    engine.compressor.disconnect();
    engine.chorusDry.disconnect();
    engine.chorusDelay.disconnect();
    engine.chorusGain.disconnect();
    engine.chorusLfo.disconnect();
    engine.chorusLfoGain.disconnect();
    engine.delayDry.disconnect();
    engine.delayNode.disconnect();
    engine.delayFeedback.disconnect();
    engine.delayGain.disconnect();
    engine.reverbDry.disconnect();
    engine.reverbConvolver.disconnect();
    engine.reverbGain.disconnect();
    engine.masterGain.disconnect();
    engine.analyser.disconnect();
  } catch {}
  // Reconnect LFO since it's always running
  try {
    engine.chorusLfo.connect(engine.chorusLfoGain);
  } catch {}
}

export function destroyEngine(engine: AudioEngineState) {
  stopPlayback(engine);
  engine.chorusLfo.stop();
  engine.ctx.close();
}
