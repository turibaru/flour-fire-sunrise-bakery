// Flour & Fire — Sunrise Bakery: staged screenshot scenes.
// Resets the world, then drives the real rules forward with a simple
// autopilot (oldest ticket -> MIX -> correct FILL -> OVEN -> take when ready
// -> FINISH when needed -> SERVE), keeping the snapshot that best matches
// each scene. The autopilot speaks the game's own input protocol: one
// snapshot per tick { moveX, moveY, interact, fill, clickX, clickY } where
// clickX/clickY walks the chef to a station and interact is pulsed while
// working there. No randomness here: the world RNG is seeded, so re-running
// a scene with the same seed reproduces the same frame.

import { createWorld, step, recipeById } from './world.js';
import { FILLINGS } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const DT = 1 / 30;
const STOP_RADIUS = 60; // close enough to a station centre to work there
const INTERACT_EVERY = 10; // pulse interact once every N ticks while working

// ---- recipe data (world.js recipeById is the authority) ----

function recipeInfo(recipeId) {
  const r = typeof recipeById === 'function' ? recipeById(recipeId) : undefined;
  if (r) {
    return {
      fill: r.fill || null, // filling id: 'chocolate' | 'berry' | 'custard' | 'cinnamon'
      finish: !!r.finish,
      bake: r.bakeTime || 8,
      steps: Array.isArray(r.steps) ? r.steps : [],
    };
  }
  return { fill: null, finish: false, bake: 8, steps: [] };
}

function fillIndex(fillId) {
  if (!fillId || !Array.isArray(FILLINGS)) return null;
  const i = FILLINGS.findIndex((f) => f.id === fillId);
  return i >= 0 ? i : null;
}

// ---- stations ----

function findStation(world, key, fallbackIndex) {
  const stations = world.stations || [];
  const lower = key.toLowerCase();
  for (const s of stations) {
    const id = String(s.id || '').toLowerCase();
    const label = String(s.label || '').toLowerCase();
    if (id === lower || id.includes(lower) || label.includes(lower)) return s;
  }
  if (stations[fallbackIndex]) return stations[fallbackIndex];
  return null;
}

function stationCenter(s) {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---- autopilot ----

function carryingKind(carrying) {
  if (!carrying) return null;
  const k = String(carrying.kind || '').toLowerCase();
  if (k.includes('dough') || k === 'raw') return 'dough';
  if (k.includes('fill')) return 'filled';
  if (k.includes('finish') || k.includes('frost') || k.includes('glaze')) return 'finished';
  if (k.includes('bake')) return 'baked';
  return k;
}

function oldestTicket(world) {
  // The ticket that still needs dough (stage 0); other tickets are already
  // mid-pipeline and are driven by what the chef is carrying.
  const live = (world.tickets || []).filter((t) => !t.done && (t.patience || 0) > 0 && (t.stage || 0) === 0);
  if (live.length === 0) return null;
  live.sort((a, b) => (a.patience || 0) - (b.patience || 0) || (a.id || 0) - (b.id || 0));
  return live[0];
}

function anyBaking(world) {
  return (world.ovens || []).some((o) => o.item && o.item.state === 'baking');
}

function freeOvenSlot(world) {
  const ovens = world.ovens || [];
  for (let i = 0; i < ovens.length; i++) {
    if (!ovens[i].item) return i;
  }
  return -1;
}

function readyOven(world) {
  const ovens = world.ovens || [];
  for (let i = 0; i < ovens.length; i++) {
    if (ovens[i].item && ovens[i].item.state === 'ready') return i;
  }
  return -1;
}

function burntOven(world) {
  const ovens = world.ovens || [];
  for (let i = 0; i < ovens.length; i++) {
    if (ovens[i].item && ovens[i].item.state === 'burnt') return i;
  }
  return -1;
}

function decideTarget(world, patient) {
  // Returns { station, action } where action is 'interact' | 'fill' | 'wait'.
  const chef = world.chef || { x: 512, y: 490, carrying: null };
  const carrying = chef.carrying;
  const kind = carryingKind(carrying);
  // 1. Burnt item first: clear it so the slot frees up.
  if (burntOven(world) >= 0) return { station: findStation(world, 'oven', 2), action: 'interact' };
  // 2. Ready item: take it before it burns (4s grace).
  if (readyOven(world) >= 0) return { station: findStation(world, 'oven', 2), action: 'interact' };
  if (kind) {
    const info = recipeInfo(carrying.recipeId);
    if (kind === 'dough') {
      if (info.fill) return { station: findStation(world, 'fill', 1), action: 'fill', fill: info.fill };
      if (freeOvenSlot(world) >= 0) return { station: findStation(world, 'oven', 2), action: 'interact' };
      return { station: findStation(world, 'oven', 2), action: 'wait' };
    }
    if (kind === 'filled') {
      if (freeOvenSlot(world) >= 0) return { station: findStation(world, 'oven', 2), action: 'interact' };
      return { station: findStation(world, 'oven', 2), action: 'wait' };
    }
    if (kind === 'baked') {
      if (info.finish) return { station: findStation(world, 'finish', 3), action: 'interact' };
      return { station: findStation(world, 'pass', 4), action: 'interact' };
    }
    if (kind === 'finished') {
      return { station: findStation(world, 'pass', 4), action: 'interact' };
    }
    // Unknown kind: try to serve it.
    return { station: findStation(world, 'pass', 4), action: 'interact' };
  }
  // 4. Nothing carried: start the oldest ticket at MIX.
  const ticket = oldestTicket(world);
  if (!ticket) {
    // No dough job right now: in patient mode, wait by the oven while a bake
    // finishes instead of starting nothing (lets tickets pile up for the
    // serve scene); otherwise idle at MIX.
    if (patient && anyBaking(world) && !(world.mix && world.mix.active)) {
      return { station: findStation(world, 'oven', 2), action: 'wait' };
    }
    return { station: findStation(world, 'mix', 0), action: 'wait' };
  }
  return { station: findStation(world, 'mix', 0), action: 'interact' };
}

function cloneWorld(world) {
  return JSON.parse(JSON.stringify(world));
}

function restoreWorld(world, snapshot) {
  for (const k of Object.keys(world)) delete world[k];
  Object.assign(world, JSON.parse(JSON.stringify(snapshot)));
}

// ---- scene scoring: higher = frame shows more of criteria #1 ----

function plateReady(world) {
  if (readyOven(world) >= 0) return true;
  const kind = carryingKind(world.chef && world.chef.carrying);
  return kind === 'baked' || kind === 'finished';
}

function scoreScene(name, world, ctx) {
  const tickets = (world.tickets || []).filter((t) => !t.done);
  let score = (world.served || 0) * 5 + (world.money || 0) * 0.2;
  const chef = world.chef || { x: 512, y: 490 };
  if (name === 'title') {
    // The cover wants a bakery already at work: exactly two tickets on
    // the board, the chef at the MIX bowl, one bake in the oven. Served
    // count and money barely count here, or a late, nearly empty board
    // would outscore the busy frame the cover needs.
    score = (world.served || 0) * 1 + (world.money || 0) * 0.05;
    if (tickets.length === 2) score += 50;
    else score += tickets.length * 8;
    const mix = findStation(world, 'mix', 0);
    if (mix && dist(chef, stationCenter(mix)) < 80) score += 40;
    const baking = (world.ovens || []).filter((o) => o.item && o.item.state === 'baking').length;
    if (baking >= 1) score += 25;
    if (world.mix && world.mix.active) score += 10;
  } else if (name === 'mix') {
    const mix = findStation(world, 'mix', 0);
    if (mix && dist(chef, stationCenter(mix)) < 80) score += 40;
    if (tickets.length >= 2) score += 40;
    else score += tickets.length * 12;
    const baking = (world.ovens || []).filter((o) => o.item && o.item.state === 'baking').length;
    if (baking >= 1) score += 30;
    if (world.mix && world.mix.active) score += 10;
  } else if (name === 'assembly') {
    if (world.finish && world.finish.active) score += 30;
    const fin = findStation(world, 'finish', 3);
    if (fin && dist(chef, stationCenter(fin)) < 90) score += 10;
    if (plateReady(world)) score += 25;
    if ((world.combo || 0) >= 2) score += 20;
    if (tickets.length >= 2) score += 15;
    else score += tickets.length * 6;
  } else if (name === 'serve') {
    if (tickets.length >= 4) score += 120;
    else if (tickets.length === 3) score += 45;
    else score += tickets.length * 9;
    // Never freeze the best frame on the chef squeezed into the 40 px
    // gap between MIX and FILL, where the FILL panel hides half of him.
    if (chef.x > 225 && chef.x < 300 && chef.y > 165 && chef.y < 300) score -= 40;
    if (plateReady(world)) score += 30;
    if (ctx.lastServeAt != null && ctx.elapsed - ctx.lastServeAt < 4) score += 20;
    const pass = findStation(world, 'pass', 4);
    if (plateReady(world) && pass && dist(chef, stationCenter(pass)) < 90) score += 10;
    // Prefer the frame where the chef has actually reached the pass with
    // the plate: mid-walk frames park him under customer 1, where his
    // head and the carried-item bubble sit on the queue labels.
    if (plateReady(world) && pass && dist(chef, stationCenter(pass)) < 50) score += 20;
    const happy = (world.customers || []).some((c) => c.mood === 'happy');
    if (happy) score += 15;
    const latest = (world.messages || [])[(world.messages || []).length - 1];
    if (latest && /\+|\$/.test(latest.text || '')) score += 10;
  }
  const burnt = (world.ovens || []).filter((o) => o.item && o.item.state === 'burnt').length;
  score -= burnt * 25;
  return score;
}

function runAutopilot(world, name, maxSeconds, patient) {
  const ctx = { elapsed: 0, lastServeAt: null };
  let lastServed = world.served || 0;
  let lastMoney = world.money || 0;
  let best = { score: -Infinity, snapshot: cloneWorld(world) };
  let bestAt = 0;
  let clickedStationId = null;
  let lastPos = { x: (world.chef || {}).x || 0, y: (world.chef || {}).y || 0 };
  let stuckTime = 0;

  const totalSteps = Math.ceil(maxSeconds / DT);
  for (let i = 0; i < totalSteps; i++) {
    ctx.elapsed = i * DT;
    const chef = world.chef || { x: 512, y: 490, carrying: null };
    const decision = decideTarget(world, patient);
    const station = decision.station;
    const snap = { moveX: 0, moveY: 0, interact: false, fill: null, clickX: null, clickY: null };

    if (station) {
      const target = stationCenter(station);
      const d = dist(chef, target);
      const stationId = station.id || station.label || '';
      // Walk to the station with one click when the target changes, when the
      // chef has no target but is still far away, or when stuck.
      const moved = dist(chef, lastPos);
      if (d > STOP_RADIUS && chef.target) {
        if (moved < 0.5) stuckTime += DT;
        else stuckTime = 0;
      } else {
        stuckTime = 0;
      }
      lastPos = { x: chef.x, y: chef.y };
      const needsClick =
        stationId !== clickedStationId || (!chef.target && d > STOP_RADIUS) || stuckTime > 1.5;
      if (needsClick) {
        snap.clickX = target.x;
        snap.clickY = target.y;
        clickedStationId = stationId;
        stuckTime = 0;
      }
      // Work the station once the chef is close.
      if (d <= STOP_RADIUS) {
        if (decision.action === 'fill') {
          const idx = fillIndex(decision.fill);
          if (idx != null) snap.fill = idx;
          if (i % INTERACT_EVERY === 0) snap.interact = true;
        } else if (decision.action === 'interact') {
          if (i % INTERACT_EVERY === 0) snap.interact = true;
        }
        // action 'wait': stay put, no keys.
      }
    }

    step(world, DT, snap);

    if ((world.served || 0) > lastServed || (world.money || 0) > lastMoney) {
      ctx.lastServeAt = ctx.elapsed;
      lastServed = world.served || 0;
      lastMoney = world.money || 0;
    }

    // Snapshot every half second; keep the best frame for this scene.
    if (i % 15 === 14 || i === totalSteps - 1) {
      const s = scoreScene(name, world, ctx);
      if (s > best.score) {
        best = { score: s, snapshot: cloneWorld(world) };
        bestAt = ctx.elapsed;
      }
    }
    if (world.over) break;
  }
  restoreWorld(world, best.snapshot);
  return { score: best.score, at: bestAt };
}

// Scene table: how long the autopilot may run for each scene.
const SCENES = {
  title: { seconds: 75, screen: SCREEN_TITLE },
  mix: { seconds: 60, screen: SCREEN_PLAY },
  assembly: { seconds: 90, screen: SCREEN_PLAY },
  serve: { seconds: 210, screen: SCREEN_PLAY },
};

// Stage one screenshot scene. Mutates `world` in place (reset + simulated),
// returns { screen, world, best } where best is the scene match score.
// Defensive: if the caller passes a seed number (or anything that is not a
// world object) instead of a world, build a real world from that seed and
// return it, so the shot still stages and draws instead of throwing.
export function stageShot(name, world) {
  let seed = 7;
  if (world && typeof world === 'object') {
    seed = world.seed != null ? world.seed : 7;
  } else if (typeof world === 'number') {
    seed = world;
  } else if (typeof world === 'string') {
    const n = Number(world);
    if (Number.isFinite(n)) seed = n;
  }
  const fresh = createWorld(seed, 1);
  if (world && typeof world === 'object') {
    for (const k of Object.keys(world)) delete world[k];
    Object.assign(world, fresh);
  } else {
    world = fresh;
  }

  const scene = SCENES[name] || SCENES.title;
  if (scene.seconds === 0) {
    return { screen: scene.screen, world, best: 0 };
  }
  const result = runAutopilot(world, name, scene.seconds, name === 'serve');
  // Pose the serve chef at the pass: the autopilot's best frame catches
  // him mid-walk under customer 1, where his head and the carried-item
  // bubble sit on the queue labels and the oven timer. He was walking to
  // the pass with the plate, so standing him at its centre shows the
  // same moment, finished.
  if (name === 'serve') {
    const kind = carryingKind(world.chef && world.chef.carrying);
    if (kind === 'baked' || kind === 'finished') {
      const pass = findStation(world, 'pass', 4);
      if (pass) {
        const c = stationCenter(pass);
        world.chef.x = c.x;
        world.chef.y = c.y;
      }
    }
  }
  return { screen: scene.screen, world, best: result.score };
}
