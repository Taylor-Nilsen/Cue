import { writable } from 'svelte/store';
import { NARRATOR_VOICE } from './voices.js';
import { speakable, splitForSynthesis } from './speech-text.js';

/**
 * The voices.
 *
 * This is the thing Cue cannot get wrong. Your phone's built-in reader is flat
 * and robotic, and rehearsing against it is worse than rehearsing alone — so
 * Cue doesn't use it. It carries its own neural voices and speaks every line
 * with them, on-device, so an iPhone, an Android, and a laptop all hear the
 * same cast.
 *
 * The browser's own voice exists here only as a last resort for hardware that
 * genuinely can't run the model, and it says so out loud when it's in use.
 */

const MODEL_ID = import.meta.env.VITE_KOKORO_MODEL || 'onnx-community/Kokoro-82M-v1.0-ONNX';
const CACHE_LIMIT = 60;

export const voiceEngine = writable({
  status: 'cold', // cold | loading | ready | fallback
  progress: 0,
  message: '',
});

let tts = null;
let loading = null;
let audioCtx = null;
let current = null;
const cache = new Map();

/* ------------------------------------------------------------------ audio */

/**
 * iOS won't let a page make noise until a real finger has touched it, so the
 * audio context is created on the first tap and kept for the session.
 */
export function unlockAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/* ----------------------------------------------------------------- engine */

export function loadEngine() {
  if (loading) return loading;

  loading = (async () => {
    voiceEngine.set({ status: 'loading', progress: 0, message: 'Fetching the voice pack…' });
    try {
      const { KokoroTTS } = await import('kokoro-js');
      const { env } = await import('@huggingface/transformers');

      // Without cross-origin isolation the wasm backend can't use threads;
      // asking for them anyway just produces a console full of warnings.
      env.backends.onnx.wasm.numThreads = globalThis.crossOriginIsolated ? 4 : 1;

      const device = (await hasWebGPU()) ? 'webgpu' : 'wasm';
      tts = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        device,
        progress_callback: (p) => {
          if (p.status === 'progress' && p.total) {
            const pct = Math.round((p.loaded / p.total) * 100);
            voiceEngine.set({
              status: 'loading',
              progress: pct,
              message: `Fetching the voice pack… ${pct}%`,
            });
          }
        },
      });
      voiceEngine.set({ status: 'ready', progress: 100, message: '' });
    } catch (err) {
      console.warn('[cue] neural voices unavailable, falling back', err);
      tts = null;
      voiceEngine.set({
        status: 'fallback',
        progress: 0,
        message: "This device can't run Cue's voices, so it's using the browser's built-in one.",
      });
    }
  })();

  return loading;
}

async function hasWebGPU() {
  try {
    if (!navigator.gpu) return false;
    return !!(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------- synthesis */

/**
 * Render a line to audio, cached. Long speeches are split on sentence
 * boundaries and stitched back together — the model has a token ceiling, and a
 * monologue would otherwise come back truncated mid-thought.
 */
export async function synthesize(text, voice, speed = 1) {
  const clean = speakable(text);
  if (!clean) return null;

  const key = `${voice}|${speed.toFixed(2)}|${clean}`;
  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key); // keep the map in least-recently-used order
    cache.set(key, hit);
    return hit;
  }

  await loadEngine();
  if (!tts) return null;

  const chunks = splitForSynthesis(clean);
  const parts = [];
  let sampleRate = 24000;
  for (const chunk of chunks) {
    const audio = await tts.generate(chunk, { voice, speed });
    parts.push(audio.audio);
    sampleRate = audio.sampling_rate;
  }

  const buffer = toAudioBuffer(parts, sampleRate);
  cache.set(key, buffer);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return buffer;
}

/** Warm the cache for a line we're about to need, without blocking on it. */
export function prefetch(text, voice, speed = 1) {
  synthesize(text, voice, speed).catch(() => {});
}

function toAudioBuffer(parts, sampleRate) {
  const ctx = unlockAudio();
  const length = parts.reduce((n, p) => n + p.length, 0);
  const buffer = ctx.createBuffer(1, Math.max(1, length), sampleRate);
  const channel = buffer.getChannelData(0);
  let offset = 0;
  for (const part of parts) {
    channel.set(part, offset);
    offset += part.length;
  }
  return buffer;
}

/* --------------------------------------------------------------- playback */

/**
 * Speak one line. Resolves when the line is finished — or immediately when
 * it's stopped, so the reader can move on without a dangling promise.
 */
export function speak(text, voice, speed = 1) {
  return new Promise((resolve) => {
    stop();
    synthesize(text, voice, speed).then(
      (buffer) => {
        if (!buffer) return speakWithBrowserVoice(text, voice, speed, resolve);
        const ctx = unlockAudio();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
          if (current?.source === source) current = null;
          resolve();
        };
        current = { source };
        source.start();
      },
      () => speakWithBrowserVoice(text, voice, speed, resolve),
    );
  });
}

export function stop() {
  if (current?.source) {
    current.source.onended = null;
    try {
      current.source.stop();
    } catch {
      /* already finished */
    }
  }
  if (current?.utterance) window.speechSynthesis?.cancel();
  current = null;
}

/** Last resort only: ancient hardware, or WebAssembly switched off. */
function speakWithBrowserVoice(text, voice, speed, resolve) {
  const synth = window.speechSynthesis;
  const clean = speakable(text);
  if (!synth || !clean) return resolve();

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = Math.max(0.5, Math.min(2, speed));
  const wantFemale = voice.startsWith('af') || voice.startsWith('bf') || voice === NARRATOR_VOICE;
  const match = synth
    .getVoices()
    .find((v) => v.lang.startsWith('en') && (wantFemale ? /female|samantha|karen|zira/i : /male|daniel|alex|david/i).test(v.name));
  if (match) utterance.voice = match;
  utterance.onend = utterance.onerror = () => {
    current = null;
    resolve();
  };
  current = { utterance };
  synth.speak(utterance);
}

export { speakable, splitForSynthesis };
