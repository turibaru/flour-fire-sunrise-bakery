// Flour & Fire — Sunrise Bakery: the front door.
// Title screen, then the morning shift, then the end-of-day board.
// ?shot=<name>&seed=N stages one frozen frame for screenshots instead
// of running the loop at all.

import { FIELD } from './config.js';
import { createWorld, step } from './world.js';
import { createInput } from './input.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SOUND_BUTTON, draw } from './render.js';
import { initAudio, sfx, toggleMute } from './sound.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '7');

const input = createInput(canvas);
let world = createWorld(seed, 1);
let screen = SCREEN_TITLE;
let muted = false;
let paused = false;
let last = performance.now();
let muteWasDown = false;
let pauseWasDown = false;
let enterWasDown = false;
let restartWasDown = false;

// Start a shift. Winning morning N (N < 3) offers morning N+1 instead.
function startShift(day) {
  world = createWorld(seed, day);
  screen = SCREEN_PLAY;
  paused = false;
  initAudio();
}

// A sound for each kind of thing the morning can do.
const SOUND_FOR_EVENT = {
  ding: 'ding',
  pop: 'pop',
  coin: 'coin',
  error: 'error',
  click: 'click',
  win: 'coin',
  lose: 'error',
};

function playEvents(events) {
  for (const e of events) {
    const name = SOUND_FOR_EVENT[e.type];
    if (name) sfx(name);
  }
}

// One frame: read the keys, run the morning, draw it.
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // Mute toggles on the press edge, so holding the key cannot flutter it.
  const muteDown = input.isDown('KeyM');
  if (muteDown && !muteWasDown) {
    muted = toggleMute();
  }
  muteWasDown = muteDown;

  // Pause toggles on the press edge and only while playing.
  const pauseDown = input.isDown('KeyP');
  if (pauseDown && !pauseWasDown && screen === SCREEN_PLAY) {
    paused = !paused;
  }
  pauseWasDown = pauseDown;

  // One read per frame: the click it carries starts the game from the
  // title screen, and the same read feeds step() while playing.
  const inp = input.read();
  // A click on the sound button toggles mute and is swallowed here, so it
  // never starts the game from the title screen or walks the chef.
  if (
    inp.clickX !== null && inp.clickX >= SOUND_BUTTON.x && inp.clickX <= SOUND_BUTTON.x + SOUND_BUTTON.w &&
    inp.clickY !== null && inp.clickY >= SOUND_BUTTON.y && inp.clickY <= SOUND_BUTTON.y + SOUND_BUTTON.h
  ) {
    muted = toggleMute();
    inp.clickX = null;
    inp.clickY = null;
  }
  const enterDown = input.isDown('Enter');
  const restartDown = input.isDown('KeyR');
  if (screen === SCREEN_TITLE) {
    // Enter, or a click anywhere on the title panel, starts morning 1.
    if ((enterDown && !enterWasDown) || inp.clickX !== null) {
      startShift(1);
    }
  } else if (screen === SCREEN_OVER) {
    if (enterDown && !enterWasDown) {
      // A won morning offers the next one; anything else replays this day.
      const nextDay = world.won && world.day < 3 ? world.day + 1 : world.day;
      startShift(nextDay);
    } else if (restartDown && !restartWasDown) {
      startShift(world.day);
    }
  }
  enterWasDown = enterDown;
  restartWasDown = restartDown;

  // A paused shift freezes: step() never runs, so the clock, the ovens,
  // and every patience bar all hold still until P is pressed again.
  if (screen === SCREEN_PLAY && !paused) {
    const events = step(world, dt, inp);
    playEvents(events);
    if (world.over) {
      screen = SCREEN_OVER;
      paused = false;
    }
  }

  // A real boolean, not an object: draw() picks the sound label from it.
  draw(ctx, world, screen, { muted, paused });
  requestAnimationFrame(frame);
}

// Screenshot mode: build the world from the seed, pose the morning, draw
// once, never loop.
if (shotName) {
  const staged = stageShot(shotName, world);
  draw(ctx, staged.world, staged.screen, { muted: false, paused: false });
} else {
  requestAnimationFrame(frame);
}
