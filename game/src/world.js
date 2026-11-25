// Flour & Fire — Sunrise Bakery: the whole morning, as pure data.
// No canvas, no sound, no DOM in here, so a headless test can run a full
// shift by calling step() in a loop and watching the numbers move.
//
// Input shape (one plain object per frame):
//   { moveX, moveY }  -1..1, from keys or a held pointer
//   interact          true on the frame Space/E (or a tap) fires
//   fill             null, or 0-3 when a filling key (1-4) was pressed
//   clickX, clickY   canvas pixels of a fresh click, or null
//
// step() returns a list of events for the frame, e.g. { type: 'ding' }.
// main.js turns those into sounds; shots.js drives an autopilot with them.

import {
  FIELD, RECIPES, DAY_RECIPES, DAY_TARGETS, TICKET_INTERVALS, PATIENCE,
  SHIFT_SECONDS, OVEN_SLOTS, MAX_TICKETS, BURN_GRACE, CHEF_SPEED,
  STATIONS, CHEF_START, CUSTOMER_SPOTS, FILLINGS,
} from './config.js';
import { makeDice } from './random.js';

// Look a recipe up by id. Every id in a ticket comes from this table.
export function recipeById(id) {
  return RECIPES.find((r) => r.id === id);
}

// Recipes the current morning is allowed to sell.
export function recipesForDay(day) {
  const ids = DAY_RECIPES[Math.min(Math.max(day, 1), 3) - 1];
  return ids.map(recipeById);
}

// Fresh morning. day is 1, 2 or 3; seed drives tickets and customers.
export function createWorld(seed, day = 1) {
  const morning = Math.min(Math.max(day, 1), 3);
  const dice = makeDice(seed * 7919 + morning * 131);
  return {
    seed,
    day: morning,
    timeLeft: SHIFT_SECONDS,
    shiftSeconds: SHIFT_SECONDS,
    money: 0,
    target: DAY_TARGETS[morning - 1],
    score: 0,
    combo: 0,
    bestCombo: 0,
    served: 0,
    lost: 0,
    chef: { x: CHEF_START.x, y: CHEF_START.y, carrying: null, target: null, targetStation: null },
    tickets: [],
    ovens: [
      { slot: 0, item: null },
      { slot: 1, item: null },
    ],
    mix: { active: false, progress: 0, duration: 0, recipeId: null, ticketId: null },
    finish: { active: false, progress: 0, duration: 0, recipeId: null, ticketId: null },
    stations: STATIONS.map((s) => ({ ...s })),
    customers: CUSTOMER_SPOTS.map((p) => ({ x: p.x, y: p.y, mood: 'happy' })),
    messages: [],
    over: false,
    won: false,
    // Bookkeeping the renderer never reads.
    selectedFill: 0,
    spawnTimer: 5,
    elapsed: 0,
    nextTicketId: 1,
    dice,
  };
}

// How far a chef's hands reach past a station's edge, in pixels.
const REACH = 48;

// Is the chef close enough to work this station?
function nearStation(world, station) {
  const c = world.chef;
  return (
    c.x > station.x - REACH &&
    c.x < station.x + station.w + REACH &&
    c.y > station.y - REACH &&
    c.y < station.y + station.h + REACH
  );
}

// The station under a point, or null when the point is open floor.
export function stationAt(world, x, y) {
  return world.stations.find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) || null;
}

// Pin a short line to the status bar; old lines fade out on their own.
function say(world, text) {
  world.messages.push({ text, t: 5 });
  if (world.messages.length > 4) world.messages.shift();
}

// The oldest ticket still waiting on its first step.
function oldestFreshTicket(world) {
  return world.tickets.find((t) => t.stage === 0 && !t.done) || null;
}

// The ticket a carried item belongs to.
function ticketFor(world, ticketId) {
  return world.tickets.find((t) => t.id === ticketId) || null;
}

// Drop everything tied to a ticket that just walked out: the chef's hands
// empty, the oven slot clears, and any half-mixed dough is scrapped.
function clearTicketWork(world, ticketId) {
  if (world.chef.carrying && world.chef.carrying.ticketId === ticketId) {
    world.chef.carrying = null;
  }
  for (const oven of world.ovens) {
    if (oven.item && oven.item.ticketId === ticketId) oven.item = null;
  }
  if (world.mix.active && world.mix.ticketId === ticketId) {
    world.mix = { active: false, progress: 0, duration: 0, recipeId: null, ticketId: null };
  }
  if (world.finish.active && world.finish.ticketId === ticketId) {
    world.finish = { active: false, progress: 0, duration: 0, recipeId: null, ticketId: null };
  }
}

// Open a new ticket on the board, if a slot is free.
function spawnTicket(world) {
  if (world.tickets.length >= MAX_TICKETS) return false;
  const menu = recipesForDay(world.day);
  const recipe = world.dice.pick(menu);
  const maxPatience = PATIENCE[world.day - 1];
  world.tickets.push({
    id: world.nextTicketId++,
    recipeId: recipe.id,
    patience: maxPatience,
    maxPatience,
    stage: 0,
    done: false,
    angry: false,
  });
  return true;
}

// Serve a finished pastry: pay the price, add a speed tip, multiply by
// the combo, and retire the ticket.
function serveTicket(world, ticket, events) {
  const recipe = recipeById(ticket.recipeId);
  const hurry = Math.max(0, ticket.patience / ticket.maxPatience);
  const tip = Math.round(recipe.price * 0.5 * hurry);
  world.combo += 1;
  if (world.combo > world.bestCombo) world.bestCombo = world.combo;
  const mult = world.combo >= 6 ? 3 : world.combo >= 3 ? 2 : 1;
  const earned = (recipe.price + tip) * mult;
  world.money += earned;
  world.score = world.money + world.served * 10 + world.bestCombo * 5;
  world.served += 1;
  ticket.done = true;
  world.tickets = world.tickets.filter((t) => t.id !== ticket.id);
  const multText = mult > 1 ? ` x${mult} combo!` : '';
  say(world, `Served ${recipe.name} +$${earned}${multText}`);
  events.push({ type: 'coin', text: `+$${earned}` });
  return earned;
}

// One station's job, fired when the chef presses interact nearby.
function useStation(world, stationId, events) {
  const chef = world.chef;
  if (stationId === 'mix') {
    if (chef.carrying) {
      say(world, 'Hands full — serve or set it down first.');
      events.push({ type: 'error' });
      return;
    }
    if (world.mix.active) return; // already kneading, progress runs below
    const ticket = oldestFreshTicket(world);
    if (!ticket) {
      say(world, 'No ticket needs dough right now.');
      return;
    }
    const recipe = recipeById(ticket.recipeId);
    world.mix = { active: true, progress: 0, duration: recipe.mixTime, recipeId: recipe.id, ticketId: ticket.id };
    say(world, `Mixing ${recipe.name} dough…`);
    events.push({ type: 'pop' });
    return;
  }

  if (stationId === 'fill') {
    if (!chef.carrying || chef.carrying.kind !== 'dough') {
      say(world, 'Bring dough here to fill it.');
      events.push({ type: 'error' });
      return;
    }
    const ticket = ticketFor(world, chef.carrying.ticketId);
    const recipe = recipeById(chef.carrying.recipeId);
    if (!ticket || !recipe.fill) {
      say(world, 'This one needs no filling.');
      events.push({ type: 'error' });
      return;
    }
    const want = FILLINGS[world.selectedFill];
    if (want.id !== recipe.fill) {
      say(world, `Wrong filling! ${recipe.name} wants ${recipe.fill}.`);
      events.push({ type: 'error' });
      return;
    }
    chef.carrying = { kind: 'filled', recipeId: recipe.id, fill: want.id, ticketId: ticket.id };
    ticket.stage += 1;
    say(world, `${recipe.name} filled with ${want.label}.`);
    events.push({ type: 'pop' });
    return;
  }

  if (stationId === 'oven') {
    // Hands busy: load the oven with what the chef carries.
    if (chef.carrying && (chef.carrying.kind === 'dough' || chef.carrying.kind === 'filled')) {
      const ticket = ticketFor(world, chef.carrying.ticketId);
      const recipe = recipeById(chef.carrying.recipeId);
      if (!ticket || !recipe) return;
      if (recipe.fill && chef.carrying.kind !== 'filled') {
        say(world, `Fill the ${recipe.name} first!`);
        events.push({ type: 'error' });
        return;
      }
      const free = world.ovens.find((o) => !o.item);
      if (!free) {
        say(world, 'Both ovens are full!');
        events.push({ type: 'error' });
        return;
      }
      free.item = {
        recipeId: recipe.id,
        fill: chef.carrying.fill || null,
        ticketId: ticket.id,
        bakeLeft: recipe.bakeTime,
        state: 'baking',
      };
      ticket.stage += 1;
      chef.carrying = null;
      say(world, `${recipe.name} in the oven — ${recipe.bakeTime}s.`);
      events.push({ type: 'pop' });
      return;
    }
    // Hands free: take a ready bake, or bin a burnt one.
    const ready = world.ovens.find((o) => o.item && o.item.state === 'ready');
    if (ready) {
      chef.carrying = { kind: 'baked', recipeId: ready.item.recipeId, fill: ready.item.fill, ticketId: ready.item.ticketId };
      ready.item = null;
      say(world, 'Fresh from the oven!');
      events.push({ type: 'pop' });
      return;
    }
    const burnt = world.ovens.find((o) => o.item && o.item.state === 'burnt');
    if (burnt) {
      const ticket = ticketFor(world, burnt.item.ticketId);
      burnt.item = null;
      if (ticket) ticket.stage = 0; // start this pastry over from MIX
      say(world, 'Burnt! Binned — start that one over.');
      events.push({ type: 'error' });
      return;
    }
    say(world, 'Nothing to take from the ovens.');
    return;
  }

  if (stationId === 'finish') {
    if (!chef.carrying || chef.carrying.kind !== 'baked') {
      say(world, 'Bring a fresh bake here to finish it.');
      events.push({ type: 'error' });
      return;
    }
    const ticket = ticketFor(world, chef.carrying.ticketId);
    const recipe = recipeById(chef.carrying.recipeId);
    if (!ticket || !recipe.finish) {
      say(world, 'This one needs no finishing touch.');
      events.push({ type: 'error' });
      return;
    }
    if (world.finish.active) return;
    world.finish = { active: true, progress: 0, duration: recipe.finishTime, recipeId: recipe.id, ticketId: ticket.id };
    say(world, `Adding ${recipe.finish} to the ${recipe.name}…`);
    events.push({ type: 'pop' });
    return;
  }

  if (stationId === 'pass') {
    if (!chef.carrying || (chef.carrying.kind !== 'baked' && chef.carrying.kind !== 'finished')) {
      say(world, 'Bring a finished pastry to serve.');
      events.push({ type: 'error' });
      return;
    }
    const ticket = ticketFor(world, chef.carrying.ticketId);
    const recipe = recipeById(chef.carrying.recipeId);
    if (!ticket || !recipe) {
      chef.carrying = null;
      return;
    }
    if (ticket.stage < recipe.steps.length) {
      say(world, `${recipe.name} is not ready yet.`);
      events.push({ type: 'error' });
      return;
    }
    chef.carrying = null;
    serveTicket(world, ticket, events);
    return;
  }
}

// Advance the morning by dt seconds. Pure: same inputs, same outcome.
export function step(world, dt, input = {}) {
  const events = [];
  if (world.over) return events;
  const frame = Math.min(Math.max(dt, 0), 0.05);
  world.elapsed += frame;
  world.timeLeft -= frame;

  // --- Filling choice (keys 1-4) ---------------------------------------
  if (typeof input.fill === 'number' && input.fill >= 0 && input.fill < FILLINGS.length) {
    world.selectedFill = input.fill;
    events.push({ type: 'click' });
  }

  // --- Chef movement ----------------------------------------------------
  const chef = world.chef;
  let mx = input.moveX || 0;
  let my = input.moveY || 0;
  if (input.clickX !== undefined && input.clickX !== null && input.clickY !== undefined && input.clickY !== null) {
    // Click-to-move only answers taps on the kitchen floor (below the
    // order board, above the bottom bar). A tap on the top bar or the
    // board is not a walk order: the old code aimed the chef at y ~30,
    // which the floor clamp could never reach, so the chef walked to
    // y 160 and waited there forever. Floor taps are clamped into the
    // patch the chef can actually stand on.
    if (input.clickY >= 150 && input.clickY < 560) {
      chef.target = {
        x: Math.min(Math.max(input.clickX, 24), FIELD.width - 24),
        y: Math.min(Math.max(input.clickY, 160), FIELD.height - 96),
      };
      chef.targetStation = stationAt(world, input.clickX, input.clickY);
      chef.stuckFrames = 0;
    }
  }
  if ((mx !== 0 || my !== 0) && chef.target) chef.target = null; // keys win over a click walk
  if (chef.target && mx === 0 && my === 0) {
    const dx = chef.target.x - chef.x;
    const dy = chef.target.y - chef.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      chef.target = null;
      if (chef.targetStation) {
        const station = chef.targetStation;
        chef.targetStation = null;
        useStation(world, station.id, events);
      }
    } else {
      mx = dx / dist;
      my = dy / dist;
    }
  }
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my) || 1;
    chef.x += (mx / len) * CHEF_SPEED * frame;
    chef.y += (my / len) * CHEF_SPEED * frame;
    chef.x = Math.min(Math.max(chef.x, 24), FIELD.width - 24);
    chef.y = Math.min(Math.max(chef.y, 160), FIELD.height - 96);
  }

  // A target the chef cannot close on (a station edge, a clamp corner)
  // is dropped after ~1.5s of no progress, so the chef never waits
  // forever on a walk order he cannot finish.
  if (chef.target) {
    const px = chef.px !== undefined ? chef.px : chef.x;
    const py = chef.py !== undefined ? chef.py : chef.y;
    if (Math.hypot(chef.x - px, chef.y - py) < 0.5) {
      chef.stuckFrames = (chef.stuckFrames || 0) + 1;
      if (chef.stuckFrames > 45) {
        chef.target = null;
        chef.targetStation = null;
        chef.stuckFrames = 0;
      }
    } else {
      chef.stuckFrames = 0;
    }
    chef.px = chef.x;
    chef.py = chef.y;
  }

  // --- Interact key ------------------------------------------------------
  if (input.interact) {
    const station = world.stations.find((s) => nearStation(world, s));
    if (station) useStation(world, station.id, events);
    else say(world, 'Walk up to a station to use it.');
  }

  // --- Mixing channel: only kneads while the chef stays at the bowl -----
  if (world.mix.active) {
    const mixStation = world.stations.find((s) => s.id === 'mix');
    if (nearStation(world, mixStation)) {
      world.mix.progress += frame;
      if (world.mix.progress >= world.mix.duration) {
        const ticket = ticketFor(world, world.mix.ticketId);
        const recipeId = world.mix.recipeId;
        world.mix = { active: false, progress: 0, duration: 0, recipeId: null, ticketId: null };
        if (ticket && !chef.carrying) {
          chef.carrying = { kind: 'dough', recipeId, fill: null, ticketId: ticket.id };
          ticket.stage += 1;
          say(world, 'Dough ready!');
          events.push({ type: 'pop' });
        }
      }
    }
  }

  // --- Finishing channel: same stay-close rule as mixing ----------------
  if (world.finish.active) {
    const finStation = world.stations.find((s) => s.id === 'finish');
    if (nearStation(world, finStation)) {
      world.finish.progress += frame;
      if (world.finish.progress >= world.finish.duration) {
        const ticket = ticketFor(world, world.finish.ticketId);
        const recipeId = world.finish.recipeId;
        world.finish = { active: false, progress: 0, duration: 0, recipeId: null, ticketId: null };
        if (ticket && chef.carrying && chef.carrying.kind === 'baked') {
          chef.carrying = { kind: 'finished', recipeId, fill: chef.carrying.fill, ticketId: ticket.id };
          ticket.stage += 1;
          say(world, `${recipeById(recipeId).name} finished!`);
          events.push({ type: 'pop' });
        }
      }
    }
  }

  // --- Ovens: bake down, ding at ready, burn four seconds late ----------
  for (const oven of world.ovens) {
    const item = oven.item;
    if (!item || item.state === 'burnt') continue;
    if (item.state === 'baking') {
      item.bakeLeft -= frame;
      if (item.bakeLeft <= 0) {
        item.bakeLeft = 0;
        item.state = 'ready';
        say(world, `Oven ding! ${recipeById(item.recipeId).name} ready.`);
        events.push({ type: 'ding', text: recipeById(item.recipeId).name });
      }
    } else if (item.state === 'ready') {
      item.bakeLeft -= frame; // counts down past zero into the burn window
      if (item.bakeLeft < -BURN_GRACE) {
        item.state = 'burnt';
        say(world, `Burnt! A ${recipeById(item.recipeId).name} turned to charcoal.`);
        events.push({ type: 'burnt', text: recipeById(item.recipeId).name });
      }
    }
  }

  // --- New tickets --------------------------------------------------------
  world.spawnTimer -= frame;
  if (world.spawnTimer <= 0) {
    spawnTicket(world);
    const jitter = 0.85 + world.dice.float() * 0.3;
    world.spawnTimer = TICKET_INTERVALS[world.day - 1] * jitter;
  }

  // --- Patience: the board's clocks all run down together ----------------
  for (const ticket of [...world.tickets]) {
    ticket.patience -= frame;
    if (ticket.patience <= 0) {
      ticket.angry = true;
      world.tickets = world.tickets.filter((t) => t.id !== ticket.id);
      clearTicketWork(world, ticket.id);
      world.lost += 1;
      world.combo = 0;
      say(world, `Customer left angry — ${recipeById(ticket.recipeId).name} not served.`);
      events.push({ type: 'expired', text: recipeById(ticket.recipeId).name });
    }
  }

  // --- Customers mirror the board's worst mood ---------------------------
  let worst = 1;
  for (const ticket of world.tickets) {
    worst = Math.min(worst, ticket.patience / ticket.maxPatience);
  }
  const mood = world.tickets.length === 0 ? 'happy' : worst > 0.5 ? 'happy' : worst > 0.25 ? 'worried' : 'angry';
  for (const customer of world.customers) customer.mood = mood;

  // --- Status lines fade ---------------------------------------------------
  for (const m of world.messages) m.t -= frame;
  world.messages = world.messages.filter((m) => m.t > 0);

  // --- Shift end ------------------------------------------------------------
  // A 1e-6s slack: after exactly 7.200 ticks of 1/30s the float sum lands a
  // hair above zero (about +1.1e-11), which would leave over=false forever.
  if (world.timeLeft <= 1e-6) {
    world.timeLeft = 0;
    world.over = true;
    world.won = world.money >= world.target;
    say(world, world.won ? 'Bakery Saved! Target reached!' : 'Out of flour… target missed.');
    events.push({ type: world.won ? 'win' : 'lose' });
  }
  return events;
}
