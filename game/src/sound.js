// Flour & Fire — Sunrise Bakery: synthesized sound effects, no audio files.
// WebAudio oscillators only; the context is created lazily after the first
// user interaction (browser autoplay policy). Safe to import in Node: every
// function no-ops when there is no window / AudioContext.

let audioCtx = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  return muted;
}

// Create (or reuse) the AudioContext. Call from a user gesture.
export function initAudio() {
  if (typeof window === 'undefined') return null;
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
  return audioCtx;
}

function tone(freq, startAt, dur, type, vol) {
  if (!audioCtx || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startAt);
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(vol || 0.18, audioCtx.currentTime + startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startAt + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + startAt);
  osc.stop(audioCtx.currentTime + startAt + dur + 0.05);
}

// Named effects used by the game:
// ding = oven ready (bright two-tone bell), pop = pick up / put down,
// coin = serve + tip, error = wrong filling / burnt, click = UI click.
export function sfx(name) {
  if (typeof window === 'undefined') return;
  if (!audioCtx) initAudio();
  if (!audioCtx || muted) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  switch (name) {
    case 'ding':
      tone(1046, 0, 0.5, 'sine', 0.22);
      tone(1568, 0.12, 0.5, 'sine', 0.16);
      break;
    case 'pop':
      tone(520, 0, 0.12, 'triangle', 0.2);
      tone(780, 0.05, 0.1, 'triangle', 0.14);
      break;
    case 'coin':
      tone(988, 0, 0.12, 'square', 0.1);
      tone(1319, 0.09, 0.25, 'square', 0.1);
      break;
    case 'error':
      tone(180, 0, 0.25, 'sawtooth', 0.14);
      tone(140, 0.12, 0.3, 'sawtooth', 0.12);
      break;
    case 'click':
      tone(660, 0, 0.06, 'sine', 0.12);
      break;
    default:
      tone(440, 0, 0.08, 'sine', 0.1);
      break;
  }
}
