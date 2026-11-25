// Keyboard + mouse for the bakery. The browser side only: it listens,
// remembers, and hands world.js one plain input object per frame.
// Clicks are scaled from the canvas's on-screen size back to 1024x640.

import { FIELD, FILLINGS } from './config.js';

// Keys that start, restart, mute, or pause the game. They never move the
// chef, but they must still land in the keys set or main.js can never see
// them held down.
const ACTION_KEYS = ['Enter', 'KeyR', 'KeyM', 'KeyP'];
const MOVE_KEYS = {
  KeyW: { x: 0, y: -1 }, ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 }, ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 }, ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 }, ArrowRight: { x: 1, y: 0 },
};

export function createInput(canvas) {
  const keys = new Set();
  let interactQueued = false;
  let fillQueued = null;
  let clickQueued = null;

  function onKeyDown(e) {
    if (MOVE_KEYS[e.code]) {
      keys.add(e.code);
      e.preventDefault();
      return;
    }
    if (ACTION_KEYS.includes(e.code)) {
      keys.add(e.code);
      e.preventDefault();
      return;
    }
    if (e.code === 'Space' || e.code === 'KeyE') {
      if (!e.repeat) interactQueued = true;
      e.preventDefault();
      return;
    }
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= FILLINGS.length) fillQueued = n - 1;
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD.width;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD.height;
    clickQueued = { x, y };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointer);

  return {
    keys,

    // True while the matching key is held down.
    isDown(code) {
      return keys.has(code);
    },

    // One frame's worth of input for step(). Edge flags (interact, fill,
    // click) are consumed here, so holding a key never double-fires.
    read() {
      let mx = 0;
      let my = 0;
      for (const code of keys) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          mx += dir.x;
          my += dir.y;
        }
      }
      const out = {
        moveX: mx,
        moveY: my,
        interact: interactQueued,
        fill: fillQueued,
        clickX: clickQueued ? clickQueued.x : null,
        clickY: clickQueued ? clickQueued.y : null,
      };
      interactQueued = false;
      fillQueued = null;
      clickQueued = null;
      return out;
    },
  };
}
