// Flour & Fire — Sunrise Bakery: all drawing, Canvas 2D only, no external images.
// Reads the world state shape from the design spec section 3 (no other contract).
// Every label is drawn with a system sans font. Most labels run 13px or
// larger; a few secondary notes that must fit a small panel — the jar
// names, the empty-slot word, the patience caption — run 10-11px.
// Filling names come from config.js (the authority); render.js never
// invents its own spelling for one.

import { FILLINGS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

// Palette from spec section 2.3.
export const COLORS = {
  cream: '#FFF6E5',
  creamDark: '#F5E6C8',
  amber: '#E8A33D',
  amberDark: '#C77F1F',
  terracotta: '#C65D3B',
  sage: '#7A9B6D',
  sageDark: '#55744A',
  ink: '#4A3226',
  inkSoft: '#6B4A35',
  white: '#FFFFFF',
  flour: '#FBF3DF',
  gold: '#F2C14E',
  red: '#C0392B',
  green: '#4E9A51',
};

// Recipe meta from spec section 2.2 (name, price, fill, finish, bake seconds).
// recipeId is the string id (e.g. 'berry-tart'), matching world.js.
export const RECIPES = [
  { id: 'butter-croissant', name: 'Butter Croissant', price: 6, fill: null, finish: false, bake: 8, steps: ['mix', 'bake'] },
  { id: 'choco-danish', name: 'Choco Danish', price: 8, fill: 'chocolate', finish: false, bake: 8, steps: ['mix', 'fill', 'bake'] },
  { id: 'berry-tart', name: 'Berry Tart', price: 10, fill: 'berry', finish: true, bake: 6, steps: ['mix', 'fill', 'bake', 'finish'] },
  { id: 'cinnamon-roll', name: 'Cinnamon Roll', price: 11, fill: 'cinnamon', finish: true, bake: 10, steps: ['mix', 'fill', 'bake', 'finish'] },
  { id: 'custard-bun', name: 'Custard Bun', price: 9, fill: 'custard', finish: false, bake: 7, steps: ['mix', 'fill', 'bake'] },
  { id: 'sourdough-loaf', name: 'Sourdough Loaf', price: 7, fill: null, finish: false, bake: 12, steps: ['mix', 'bake'] },
  { id: 'choco-croissant', name: 'Choco Croissant', price: 12, fill: 'chocolate', finish: true, bake: 9, steps: ['mix', 'fill', 'bake', 'finish'] },
];

// Filling ids and display labels, straight from config.js — the same words
// the tickets and the world use, so a jar can never disagree with a recipe.
export const FILL_NAMES = FILLINGS.map((f) => f.id);
export const FILL_LABELS = FILLINGS.map((f) => f.label);
export const FILL_COLORS = {
  chocolate: '#6B4226',
  berry: '#A8325A',
  custard: '#F2C14E',
  cinnamon: '#9C6644',
};

const W = 1024;
const H = 640;
const TOP_H = 64;
const BOARD_Y = 64;
const BOARD_H = 86;
const KITCHEN_Y = 150;
const KITCHEN_H = 410;
const BOTTOM_Y = 560;

// The mute button's hit box, shared with main.js so a click on it toggles
// sound instead of being read as a walk order.
export const SOUND_BUTTON = { x: 906, y: 12, w: 102, h: 40 };

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, weight, align) {
  ctx.font = (weight || 'normal') + ' ' + size + 'px Arial, Helvetica, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(str), x, y);
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// Deterministic pseudo-random from an integer (for steam / sparkle placement).
function pseudo(i, seed) {
  let n = (seed * 374761393 + i * 668265263) ^ 0x5bf03635;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function recipeOf(recipeId) {
  if (typeof recipeId === 'string') {
    const found = RECIPES.find((r) => r.id === recipeId);
    if (found) return found;
  }
  if (typeof recipeId === 'number' && RECIPES[recipeId]) return RECIPES[recipeId];
  return { name: 'Pastry', price: 5, fill: null, finish: false, bake: 8, steps: ['mix', 'bake'] };
}

// Step dots for a ticket: recipe steps + SERVE; done = ticket.stage completed.
function stepCount(recipe) {
  return (recipe.steps ? recipe.steps.length : 2) + 1; // + serve
}

function stepNames(recipe) {
  const names = { mix: 'MIX', fill: 'FILL', bake: 'BAKE', finish: 'FINISH' };
  const steps = (recipe.steps || ['mix', 'bake']).map((s) => names[s] || s.toUpperCase());
  steps.push('SERVE');
  return steps;
}

function patienceColor(frac) {
  if (frac > 0.5) return COLORS.green;
  if (frac > 0.25) return COLORS.amber;
  return COLORS.red;
}

function drawClock(ctx, timeLeft, totalSeconds) {
  const total = totalSeconds || 240;
  const tl = Number.isFinite(timeLeft) ? timeLeft : total; // unknown -> 06:00
  const frac = clamp(1 - tl / total, 0, 1); // 0 at 06:00, 1 at 10:00
  const mins = 360 + frac * 240; // minutes since midnight
  const hh = Math.floor(mins / 60);
  const mm = Math.floor(mins % 60);
  const label = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  // Clock face.
  const cx = 512;
  const cy = 32;
  ctx.save();
  ctx.fillStyle = COLORS.white;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx - 52, cy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Hands: hour hand creeps 06:00 -> 10:00, minute hand spins.
  const hourAngle = ((frac * 4) / 12) * Math.PI * 2 - Math.PI / 2 + (6 / 12) * Math.PI * 2;
  const minAngle = (frac * 240 * 6 * Math.PI) / 180 - Math.PI / 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy);
  ctx.lineTo(cx - 52 + Math.cos(hourAngle) * 12, cy + Math.sin(hourAngle) * 12);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.terracotta;
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy);
  ctx.lineTo(cx - 52 + Math.cos(minAngle) * 18, cy + Math.sin(minAngle) * 18);
  ctx.stroke();
  ctx.restore();
  text(ctx, label, cx - 20, cy + 9, 26, COLORS.ink, 'bold', 'left');
  text(ctx, 'SHIFT 06:00-10:00', cx - 20, cy - 14, 11, COLORS.inkSoft, 'bold', 'left');
}

function drawTopBar(ctx, world, muted) {
  ctx.fillStyle = COLORS.amber;
  ctx.fillRect(0, 0, W, TOP_H);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, TOP_H - 4, W, 4);
  // Logo left.
  text(ctx, 'FLOUR & FIRE', 16, 28, 24, COLORS.ink, 'bold');
  text(ctx, 'Sunrise Bakery', 16, 50, 14, COLORS.inkSoft, 'bold');
  // Clock centre.
  drawClock(ctx, world.timeLeft, world.shiftSeconds);
  // Money / target / combo right.
  const money = '$' + (world.money || 0);
  const target = 'Target $' + (world.target || 0);
  text(ctx, money, 760, 30, 26, COLORS.ink, 'bold', 'right');
  text(ctx, target, 760, 52, 13, COLORS.inkSoft, 'bold', 'right');
  const combo = world.combo || 0;
  const comboTxt = combo >= 2 ? 'COMBO x' + combo : 'COMBO x1';
  ctx.fillStyle = combo >= 2 ? COLORS.terracotta : COLORS.creamDark;
  rr(ctx, 776, 12, 118, 40, 8);
  ctx.fill();
  text(ctx, comboTxt, 835, 38, 16, COLORS.white, 'bold', 'center');
  // Sound button.
  ctx.fillStyle = COLORS.cream;
  rr(ctx, SOUND_BUTTON.x, SOUND_BUTTON.y, SOUND_BUTTON.w, SOUND_BUTTON.h, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, muted ? 'MUTE [M]' : 'SOUND [M]', SOUND_BUTTON.x + SOUND_BUTTON.w / 2, 38, 14, COLORS.ink, 'bold', 'center');
}

function drawTicket(ctx, x, y, w, h, ticket, index) {
  ctx.fillStyle = COLORS.white;
  rr(ctx, x, y, w, h, 8);
  ctx.fill();
  if (!ticket) {
    ctx.strokeStyle = '#D8C9A8';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, h, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, 'SLOT ' + (index + 1), x + w / 2, y + h / 2 - 2, 13, '#B9A67E', 'bold', 'center');
    text(ctx, 'menunggu pelanggan', x + w / 2, y + h / 2 + 16, 11, '#B9A67E', 'normal', 'center');
    return;
  }
  const recipe = recipeOf(ticket.recipeId);
  const frac = ticket.maxPatience ? clamp(ticket.patience / ticket.maxPatience, 0, 1) : 0;
  const angry = ticket.angry || frac < 0.2;
  ctx.strokeStyle = angry ? COLORS.red : COLORS.amber;
  ctx.lineWidth = angry ? 3 : 2;
  rr(ctx, x, y, w, h, 8);
  ctx.stroke();
  if (angry) {
    ctx.fillStyle = 'rgba(192,57,43,0.12)';
    rr(ctx, x, y, w, h, 8);
    ctx.fill();
  }
  text(ctx, '#' + ticket.id + '  ' + recipe.name, x + 10, y + 20, 14, COLORS.ink, 'bold');
  text(ctx, '$' + recipe.price, x + w - 10, y + 20, 15, COLORS.terracotta, 'bold', 'right');
  if (angry) text(ctx, 'MARAH!', x + w - 10, y + 38, 12, COLORS.red, 'bold', 'right');
  // Step dots: filled = ticket.stage completed.
  const total = stepCount(recipe);
  const done = clamp(ticket.stage || 0, 0, total);
  for (let i = 0; i < total; i++) {
    const dx = x + 14 + i * 18;
    const dy = y + 33;
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, Math.PI * 2);
    ctx.fillStyle = i < done ? COLORS.sage : '#E4D5B5';
    ctx.fill();
    ctx.strokeStyle = COLORS.inkSoft;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const stageNames = stepNames(recipe);
  const label = ticket.done ? 'SIAP!' : stageNames[clamp(done, 0, stageNames.length - 1)] || 'MIX';
  text(ctx, label, x + 14 + total * 18 + 6, y + 37, 12, COLORS.inkSoft, 'bold');
  // Patience bar (green -> red).
  ctx.fillStyle = '#EADFC6';
  rr(ctx, x + 10, y + 57, w - 20, 9, 4);
  ctx.fill();
  ctx.fillStyle = patienceColor(frac);
  if (frac > 0.02) {
    rr(ctx, x + 10, y + 57, (w - 20) * frac, 9, 4);
    ctx.fill();
  }
  text(ctx, 'KESABARAN', x + 10, y + 53, 11, COLORS.inkSoft, 'bold');
}

function drawOrderBoard(ctx, world) {
  ctx.fillStyle = COLORS.creamDark;
  ctx.fillRect(0, BOARD_Y, W, BOARD_H);
  text(ctx, 'ORDER BOARD', 16, BOARD_Y + 22, 14, COLORS.ink, 'bold');
  text(ctx, (world.tickets || []).length + '/4 tiket aktif', 16, BOARD_Y + 40, 12, COLORS.inkSoft, 'normal');
  const slotW = 210;
  const gap = 10;
  const startX = 132;
  for (let i = 0; i < 4; i++) {
    const t = (world.tickets || [])[i] || null;
    drawTicket(ctx, startX + i * (slotW + gap), BOARD_Y + 8, slotW, BOARD_H - 16, t, i);
  }
}

function drawPastryIcon(ctx, cx, cy, scale, kind, fill) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (kind === 'dough') {
    ctx.fillStyle = '#F3E2B8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D9BE85';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (kind === 'filled') {
    ctx.fillStyle = '#F3E2B8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FILL_COLORS[fill] || COLORS.terracotta;
    ctx.beginPath();
    ctx.ellipse(0, -3, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'baked' || kind === 'finished') {
    // Golden croissant-ish crescent.
    ctx.fillStyle = '#D98E2B';
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 10, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E8A33D';
    ctx.beginPath();
    ctx.ellipse(0, -2, 13, 7, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B06A14';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(-4, 4);
    ctx.moveTo(0, -7);
    ctx.lineTo(4, 3);
    ctx.moveTo(8, -5);
    ctx.lineTo(11, 3);
    ctx.stroke();
    if (kind === 'finished') {
      ctx.fillStyle = '#FFF6E5';
      ctx.beginPath();
      ctx.ellipse(0, -4, 10, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F2A0B5';
      ctx.beginPath();
      ctx.arc(-6, -5, 2, 0, Math.PI * 2);
      ctx.arc(5, -6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function stationLabel(ctx, s) {
  text(ctx, s.label || s.id || 'STASIUN', s.x + s.w / 2, s.y + 20, 15, COLORS.ink, 'bold', 'center');
}

function drawMixStation(ctx, s, world) {
  ctx.fillStyle = '#FDF1D7';
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.strokeStyle = COLORS.amberDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  stationLabel(ctx, s);
  // Bowl + flour + egg.
  ctx.fillStyle = '#8FB8D8';
  ctx.beginPath();
  ctx.arc(s.x + s.w / 2 - 28, s.y + 62, 26, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#FBF3DF';
  ctx.beginPath();
  ctx.ellipse(s.x + s.w / 2 - 28, s.y + 62, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(s.x + s.w / 2 + 30, s.y + 52, 16, 10, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F2C14E';
  ctx.beginPath();
  ctx.ellipse(s.x + s.w / 2 + 30, s.y + 78, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'Mangkuk + tepung + telur', s.x + s.w / 2, s.y + s.h - 10, 11, COLORS.inkSoft, 'normal', 'center');
  // The kneading bar lives in drawWorkProgress (drawn after the chef), so
  // the chef's body can never sit on top of it.
}

function drawFillStation(ctx, s) {
  ctx.fillStyle = '#FDF1D7';
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.strokeStyle = COLORS.amberDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  stationLabel(ctx, s);
  // Four labelled filling jars. Jars sit 59 px apart and the names run at
  // 10 px, so "Custard" and "Cinnamon" no longer touch each other.
  const jarW = (s.w - 24) / 4;
  for (let i = 0; i < 4; i++) {
    const jx = s.x + 12 + i * jarW + jarW / 2;
    const jy = s.y + 52;
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, jx - 18, jy - 12, 36, 34, 5);
    ctx.fill();
    ctx.strokeStyle = COLORS.inkSoft;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = FILL_COLORS[FILL_NAMES[i]];
    rr(ctx, jx - 13, jy - 2, 26, 17, 3);
    ctx.fill();
    text(ctx, String(i + 1), jx, jy - 16, 11, COLORS.inkSoft, 'bold', 'center');
    text(ctx, FILL_LABELS[i], jx, jy + 36, 10, COLORS.ink, 'bold', 'center');
  }
  text(ctx, 'Pilih isian 1-4 sesuai tiket', s.x + s.w / 2, s.y + s.h - 10, 11, COLORS.inkSoft, 'normal', 'center');
}

function drawOvenStation(ctx, s, world, seed) {
  ctx.fillStyle = '#F3D9B8';
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.strokeStyle = COLORS.terracotta;
  ctx.lineWidth = 2;
  ctx.stroke();
  stationLabel(ctx, s);
  const ovens = world.ovens || [];
  for (let slot = 0; slot < 2; slot++) {
    const ox = s.x + 14 + slot * ((s.w - 28) / 2);
    const ow = (s.w - 28) / 2 - 8;
    const oy = s.y + 28;
    const oh = 58;
    const item = ovens[slot] ? ovens[slot].item : null;
    // Oven window.
    ctx.fillStyle = '#3A2A20';
    rr(ctx, ox, oy, ow, oh, 6);
    ctx.fill();
    // A lit, empty oven reads as a free slot; a dark hole read as a dead
    // one. Empty slots get a warm lit interior with bare rack bars.
    ctx.fillStyle = item ? '#F7B733' : '#F6DEA8';
    rr(ctx, ox + 4, oy + 4, ow - 8, oh - 8, 4);
    ctx.fill();
    if (!item) {
      ctx.strokeStyle = '#C9A86A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ox + 10, oy + 22);
      ctx.lineTo(ox + ow - 10, oy + 22);
      ctx.moveTo(ox + 10, oy + 38);
      ctx.lineTo(ox + ow - 10, oy + 38);
      ctx.stroke();
    }
    if (item) {
      drawPastryIcon(ctx, ox + ow / 2, oy + oh / 2 + 4, 0.9, 'baked', item.fill);
    }
    // Ring timer.
    const recipe = item ? recipeOf(item.recipeId) : null;
    const total = recipe ? recipe.bake : 8;
    let frac = 0;
    if (item) {
      if (item.state === 'ready') frac = 1;
      else if (item.state === 'burnt') frac = 1;
      else frac = clamp(1 - (item.bakeLeft || 0) / total, 0, 1);
    }
    const rcx = ox + ow / 2;
    const rcy = oy + oh + 16;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#EADFC6';
    ctx.beginPath();
    ctx.arc(rcx, rcy, 10, 0, Math.PI * 2);
    ctx.stroke();
    if (item) {
      ctx.strokeStyle = item.state === 'ready' ? COLORS.green : item.state === 'burnt' ? COLORS.red : COLORS.amber;
      ctx.beginPath();
      ctx.arc(rcx, rcy, 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
    // The ring timer sits under its window; its label is nudged 14 px left
    // so "DING! SIAP" clears the queue strip that starts at x 772.
    const labelX = rcx - 14;
    if (item) {
      if (item.state === 'ready') {
        text(ctx, 'DING! SIAP', labelX, rcy + 26, 12, COLORS.green, 'bold', 'center');
      } else if (item.state === 'burnt') {
        text(ctx, 'GOSONG!', labelX, rcy + 26, 12, COLORS.red, 'bold', 'center');
      } else {
        text(ctx, Math.ceil(item.bakeLeft || 0) + ' dtk', labelX, rcy + 26, 12, COLORS.ink, 'bold', 'center');
      }
    } else {
      text(ctx, 'kosong', labelX, rcy + 26, 11, COLORS.inkSoft, 'normal', 'center');
    }
    // Ready glow.
    if (item && item.state === 'ready') {
      ctx.save();
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.9;
      rr(ctx, ox - 3, oy - 3, ow + 6, oh + 6, 8);
      ctx.stroke();
      ctx.restore();
      text(ctx, '*', ox + ow - 6, oy + 12, 20, COLORS.gold, 'bold', 'center');
    }
  }
  // Steam wisps above the oven (deterministic placement). Slate grey-blue,
  // never white: white steam vanishes against the cream kitchen wall.
  ctx.strokeStyle = 'rgba(120, 134, 150, 0.9)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) {
    const sx = s.x + 24 + pseudo(i, seed || 7) * (s.w - 48);
    const sy = s.y - 2 - pseudo(i + 9, seed || 7) * 8;
    ctx.beginPath();
    ctx.moveTo(sx, sy + 8);
    ctx.quadraticCurveTo(sx + 4, sy + 2, sx - 2, sy - 4);
    ctx.stroke();
  }
}

function drawFinishStation(ctx, s, world) {
  ctx.fillStyle = '#FDF1D7';
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.strokeStyle = COLORS.amberDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  stationLabel(ctx, s);
  // Frosting bag + glaze bowl.
  ctx.fillStyle = '#F2A0B5';
  ctx.beginPath();
  ctx.moveTo(s.x + s.w / 2 - 34, s.y + 44);
  ctx.lineTo(s.x + s.w / 2 - 14, s.y + 44);
  ctx.lineTo(s.x + s.w / 2 - 20, s.y + 76);
  ctx.lineTo(s.x + s.w / 2 - 28, s.y + 76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFF6E5';
  ctx.beginPath();
  ctx.ellipse(s.x + s.w / 2 + 30, s.y + 62, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F2C14E';
  ctx.beginPath();
  ctx.ellipse(s.x + s.w / 2 + 30, s.y + 60, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'Frosting / glaze', s.x + s.w / 2, s.y + s.h - 10, 11, COLORS.inkSoft, 'normal', 'center');
  // The decorating bar lives in drawWorkProgress (drawn after the chef), so
  // the chef's body can never sit on top of it.
}

function drawPassStation(ctx, s, world) {
  const ready =
    (world.ovens || []).some((o) => o.item && o.item.state === 'ready') ||
    (world.chef && world.chef.carrying && (world.chef.carrying.kind === 'baked' || world.chef.carrying.kind === 'finished'));
  ctx.fillStyle = ready ? '#FFE9A8' : '#FDF1D7';
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.strokeStyle = ready ? COLORS.gold : COLORS.amberDark;
  ctx.lineWidth = ready ? 3 : 2;
  ctx.stroke();
  stationLabel(ctx, s);
  // Serving table + plate.
  ctx.fillStyle = '#C65D3B';
  rr(ctx, s.x + 16, s.y + 52, s.w - 32, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(s.x + s.w / 2, s.y + 50, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.inkSoft;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const carrying = world.chef && world.chef.carrying;
  if (carrying && (carrying.kind === 'baked' || carrying.kind === 'finished')) {
    drawPastryIcon(ctx, s.x + s.w / 2, s.y + 44, 1, carrying.kind, carrying.fill);
  } else if ((world.ovens || []).some((o) => o.item && o.item.state === 'ready')) {
    drawPastryIcon(ctx, s.x + s.w / 2, s.y + 44, 1, 'baked', null);
  }
  if (ready) {
    ctx.save();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(s.x + s.w / 2, s.y + 50, 42, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    text(ctx, 'PIRING SIAP — ANTAR!', s.x + s.w / 2, s.y + s.h - 10, 13, COLORS.terracotta, 'bold', 'center');
  } else {
    text(ctx, 'Meja saji — antar ke pelanggan', s.x + s.w / 2, s.y + s.h - 10, 11, COLORS.inkSoft, 'normal', 'center');
  }
}

function drawCounter(ctx, world) {
  // Centre counter with ingredient icons + labels (spec 2.3).
  const x = 268;
  const y = 322;
  const w = 300;
  const h = 118;
  ctx.fillStyle = '#EFDDB6';
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = '#C9A86A';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, 'COUNTER — BAHAN', x + w / 2, y + 20, 14, COLORS.ink, 'bold', 'center');
  const items = [
    { label: 'Tepung', color: '#FBF3DF', mark: 'F' },
    { label: 'Telur', color: '#FFFFFF', mark: 'T' },
    { label: 'Mentega', color: '#F2C14E', mark: 'M' },
    { label: 'Berry', color: '#A8325A', mark: 'B' },
    { label: 'Chocolate', color: '#6B4226', mark: 'C' },
  ];
  const iw = w / items.length;
  for (let i = 0; i < items.length; i++) {
    const cx = x + iw * i + iw / 2;
    ctx.fillStyle = items[i].color;
    ctx.beginPath();
    ctx.arc(cx, y + 52, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.inkSoft;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, items[i].mark, cx, y + 57, 14, COLORS.ink, 'bold', 'center');
    text(ctx, items[i].label, cx, y + 84, 12, COLORS.ink, 'normal', 'center');
  }
  text(ctx, 'Stok bahan selalu tersedia', x + w / 2, y + h - 10, 11, COLORS.inkSoft, 'normal', 'center');
}

function drawChef(ctx, world) {
  const chef = world.chef || { x: 512, y: 480, carrying: null };
  const x = chef.x;
  const y = chef.y;
  // Shadow.
  ctx.fillStyle = 'rgba(74,50,38,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 26, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body (apron).
  ctx.fillStyle = COLORS.terracotta;
  rr(ctx, x - 16, y - 6, 32, 30, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.cream;
  rr(ctx, x - 11, y + 2, 22, 20, 5);
  ctx.fill();
  // Head + chef hat.
  ctx.fillStyle = '#F2C49B';
  ctx.beginPath();
  ctx.arc(x, y - 16, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.arc(x - 9, y - 26, 8, 0, Math.PI * 2);
  ctx.arc(x, y - 30, 9, 0, Math.PI * 2);
  ctx.arc(x + 9, y - 26, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 12, y - 28, 24, 6);
  // Eyes + smile.
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath();
  ctx.arc(x - 5, y - 17, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 17, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y - 13, 4, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Carried item, offset to the chef's upper side: to the right when the
  // chef works the left half of the floor, to the left on the right half,
  // so the pastry and its name pill never sit on the station label
  // straight above the chef's hat. The pill is sized to its text, so a
  // short name cannot reach the next panel the way the old fixed-width
  // pill reached the counter. When the chef stands high on the floor the
  // pill would land on the order board, so it flips below the chef.
  if (chef.carrying) {
    const kind = chef.carrying.kind;
    const recipe = recipeOf(chef.carrying.recipeId);
    const toRight = x < 512;
    const ix = toRight ? x + 44 : x - 44;
    drawPastryIcon(ctx, ix, y - 44, 1, kind, chef.carrying.fill);
    ctx.font = 'bold 11px Arial, Helvetica, sans-serif';
    const pillW = Math.min(170, ctx.measureText(recipe.name).width + 20);
    const pillCX = toRight ? x + 88 : x - 88;
    const pillX = clamp(pillCX - pillW / 2, 4, W - pillW - 4);
    const pillY = y - 78 < 150 ? y + 34 : y - 78;
    ctx.fillStyle = 'rgba(74,50,38,0.85)';
    rr(ctx, pillX, pillY, pillW, 16, 8);
    ctx.fill();
    text(ctx, recipe.name, pillX + pillW / 2, pillY + 12, 11, COLORS.white, 'bold', 'center');
  }
}

function drawCustomer(ctx, c, index) {
  const x = c.x;
  const y = c.y;
  const mood = c.mood || 'waiting';
  // Shadow.
  ctx.fillStyle = 'rgba(74,50,38,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 26, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body colour by mood. Blue-grey is the worried look: patience is
  // thinning (a quarter to a half left) and the customer is getting
  // nervous, but nothing is lost yet — that is red, for angry.
  const body = mood === 'happy' ? COLORS.sage : mood === 'angry' ? COLORS.red : '#7A9B9B';
  ctx.fillStyle = body;
  rr(ctx, x - 15, y - 4, 30, 28, 8);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#F2C49B';
  ctx.beginPath();
  ctx.arc(x, y - 14, 12, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = mood === 'angry' ? '#3A2A20' : '#6B4226';
  ctx.beginPath();
  ctx.arc(x, y - 18, 12, Math.PI, 0);
  ctx.fill();
  // Face by mood.
  ctx.fillStyle = COLORS.ink;
  if (mood === 'happy') {
    ctx.beginPath();
    ctx.arc(x - 4, y - 15, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 15, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - 11, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (mood === 'angry') {
    ctx.beginPath();
    ctx.arc(x - 4, y - 14, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 14, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 19);
    ctx.lineTo(x - 2, y - 17);
    ctx.moveTo(x + 7, y - 19);
    ctx.lineTo(x + 2, y - 17);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 6, 4, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  } else if (mood === 'worried') {
    ctx.beginPath();
    ctx.arc(x - 4, y - 15, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 15, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    // Eyebrows lifted towards the middle, mouth a flat line: nervous,
    // not yet angry.
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 20);
    ctx.lineTo(x - 2, y - 18);
    ctx.moveTo(x + 7, y - 20);
    ctx.lineTo(x + 2, y - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 8);
    ctx.lineTo(x + 4, y - 8);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x - 4, y - 15, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 15, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 9);
    ctx.lineTo(x + 4, y - 9);
    ctx.stroke();
  }
  text(ctx, 'Pelanggan ' + (index + 1), x, y + 42, 11, COLORS.inkSoft, 'normal', 'center');
}

function drawCustomers(ctx, world) {
  let customers = world.customers || [];
  if (customers.length === 0 && (world.tickets || []).length > 0) {
    // Derive a queue from live tickets so the scene always shows customers.
    // Same row spots as the real customer spots (x 800/890/965, y 300).
    const spots = [
      { x: 800, y: 300 },
      { x: 890, y: 300 },
      { x: 965, y: 300 },
    ];
    customers = (world.tickets || []).slice(0, 3).map((t, i) => {
      const frac = t.maxPatience ? t.patience / t.maxPatience : 1;
      return {
        x: spots[i].x,
        y: spots[i].y,
        mood: t.angry || frac < 0.2 ? 'angry' : frac < 0.5 ? 'worried' : 'happy',
      };
    });
  }
  // Queue strip behind the customer row (horizontal, y 247-343) so it never
  // washes out the SERVE station below it (y 350-470). Customers are drawn
  // 15 px above their world spot, which lifts their name labels clear of
  // the chef's head when he stands at the pass below them.
  ctx.fillStyle = 'rgba(245,230,200,0.7)';
  rr(ctx, 772, 247, 240, 96, 10);
  ctx.fill();
  text(ctx, 'ANTRIAN', 892, 235, 13, COLORS.ink, 'bold', 'center');
  for (let i = 0; i < customers.length; i++) {
    drawCustomer(ctx, { x: customers[i].x, y: customers[i].y - 15, mood: customers[i].mood }, i);
  }
  if (customers.length === 0) {
    text(ctx, 'Belum ada pelanggan', 892, 295, 13, COLORS.inkSoft, 'normal', 'center');
  }
}

function drawPopups(ctx, world) {
  // Floating "+$" popups + latest status message. Placed on the empty floor
  // strip at the bottom of the kitchen (y 498-548) so they never cover the
  // stations, jars, or oven windows above.
  const msgs = (world.messages || []).slice(-2);
  msgs.forEach((m, i) => {
    const isMoney = /\+?\$|tip|coin/i.test(m.text || '');
    const y = 498 + i * 26;
    ctx.fillStyle = isMoney ? 'rgba(78,154,81,0.95)' : 'rgba(74,50,38,0.85)';
    const w = Math.min(420, 14 + (m.text || '').length * 7.5);
    rr(ctx, 512 - w / 2, y, w, 22, 11);
    ctx.fill();
    text(ctx, m.text || '', 512, y + 15, 13, COLORS.white, 'bold', 'center');
  });
}

function drawWorkProgress(ctx, world) {
  // Both work bars are drawn AFTER the chef (drawKitchen calls this last),
  // so the "MENGADUK n%" / "MENGHIAS n%" label and bar always sit on top of
  // the chef's body and shadow instead of hiding underneath them.
  const stations = world.stations || [];
  const byId = {};
  for (const s of stations) byId[(s.id || '').toLowerCase()] = s;
  if (world.mix && world.mix.active && byId.mix) {
    const s = byId.mix;
    // progress counts elapsed seconds and duration the whole job, so the
    // bar shows the share of the job done (0.5s of 2s = 25%), never the
    // raw second count capped at 100%.
    const p = world.mix.duration > 0 ? clamp((world.mix.progress || 0) / world.mix.duration, 0, 1) : 0;
    ctx.fillStyle = '#EADFC6';
    rr(ctx, s.x + 14, s.y + s.h - 30, s.w - 28, 10, 5);
    ctx.fill();
    ctx.fillStyle = COLORS.amber;
    rr(ctx, s.x + 14, s.y + s.h - 30, (s.w - 28) * p, 10, 5);
    ctx.fill();
    text(ctx, 'MENGADUK ' + Math.round(p * 100) + '%', s.x + s.w / 2, s.y + s.h - 34, 12, COLORS.terracotta, 'bold', 'center');
  }
  if (world.finish && world.finish.active && byId.finish) {
    const s = byId.finish;
    // Same share-of-the-job rule as mixing: 0.333s of 1.5s = 22%.
    const p = world.finish.duration > 0 ? clamp((world.finish.progress || 0) / world.finish.duration, 0, 1) : 0;
    ctx.fillStyle = '#EADFC6';
    rr(ctx, s.x + 14, s.y + s.h - 30, s.w - 28, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#F2A0B5';
    rr(ctx, s.x + 14, s.y + s.h - 30, (s.w - 28) * p, 10, 5);
    ctx.fill();
    text(ctx, 'MENGHIAS ' + Math.round(p * 100) + '%', s.x + s.w / 2, s.y + s.h - 34, 12, COLORS.terracotta, 'bold', 'center');
  }
}

function drawKitchen(ctx, world) {
  // Floor.
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, KITCHEN_Y, W, KITCHEN_H);
  ctx.fillStyle = '#F1E2C0';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(0, KITCHEN_Y + i * 52, W, 2);
  }
  ctx.fillStyle = '#EAD9B5';
  ctx.fillRect(0, KITCHEN_Y, W, 6);
  const stations = world.stations || [];
  const byId = {};
  for (const s of stations) byId[(s.id || '').toLowerCase()] = s;
  // Default layout (spec 2.3) when the world carries no stations.
  const defs = [
    { id: 'mix', x: 40, y: 170, w: 200, h: 120, label: 'MIX — Adonan' },
    { id: 'fill', x: 268, y: 170, w: 300, h: 120, label: 'FILL — Isian' },
    { id: 'oven', x: 596, y: 170, w: 232, h: 120, label: 'OVEN — Panggang' },
    { id: 'finish', x: 40, y: 322, w: 200, h: 118, label: 'FINISH — Hias' },
    { id: 'pass', x: 596, y: 322, w: 232, h: 118, label: 'PASS — Saji' },
  ];
  const get = (id, def) => byId[id] || byId[def.label] || def;
  const mixS = get('mix', defs[0]);
  const fillS = get('fill', defs[1]);
  const ovenS = get('oven', defs[2]);
  const finishS = get('finish', defs[3]);
  const passS = get('pass', defs[4]);
  drawMixStation(ctx, mixS, world);
  drawFillStation(ctx, fillS);
  drawOvenStation(ctx, ovenS, world, world.seed);
  drawFinishStation(ctx, finishS, world);
  drawCounter(ctx, world);
  drawPassStation(ctx, passS, world);
  drawCustomers(ctx, world);
  drawChef(ctx, world);
  drawWorkProgress(ctx, world);
  drawPopups(ctx, world);
}

function drawBottomBar(ctx, world) {
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, BOTTOM_Y, W, H - BOTTOM_Y);
  const latest = (world.messages || [])[(world.messages || []).length - 1];
  text(ctx, latest ? latest.text : 'Selamat pagi! Mulai memanggang.', 16, BOTTOM_Y + 24, 14, COLORS.cream, 'bold');
  text(
    ctx,
    'WASD / Panah gerak  •  Klik stasiun  •  1-4 pilih isian  •  Space interact  •  M mute  •  P pause',
    16,
    BOTTOM_Y + 48,
    13,
    '#D8C9A8',
    'normal'
  );
  const right = 'Pagi ' + (world.day || 1) + '  •  Dilayani ' + (world.served || 0) + '  •  Gagal ' + (world.lost || 0) +
    '  •  Kombo terbaik x' + (world.bestCombo || 0);
  text(ctx, right, W - 16, BOTTOM_Y + 24, 13, COLORS.cream, 'normal', 'right');
  const score = 'Skor ' + (world.score || world.money || 0);
  text(ctx, score, W - 16, BOTTOM_Y + 48, 13, COLORS.gold, 'bold', 'right');
}

function drawPlay(ctx, world, muted, paused) {
  drawTopBar(ctx, world, muted);
  drawOrderBoard(ctx, world);
  drawKitchen(ctx, world);
  drawBottomBar(ctx, world);
  if (paused) {
    ctx.fillStyle = 'rgba(74,50,38,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.cream;
    rr(ctx, 362, 266, 300, 108, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 3;
    ctx.stroke();
    text(ctx, 'PAUSED', 512, 312, 32, COLORS.terracotta, 'bold', 'center');
    text(ctx, 'Tekan P untuk lanjut', 512, 344, 15, COLORS.inkSoft, 'normal', 'center');
  }
}

function drawTitle(ctx, world, muted) {
  drawPlay(ctx, world, muted);
  // Warm overlay panel. It sits low and narrow on purpose: the order
  // board stays fully visible above it and the MIX / FINISH stations and
  // the chef stay visible to its left, so the cover already shows the
  // bakery at work instead of hiding it behind the title.
  ctx.fillStyle = 'rgba(74,50,38,0.38)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.cream;
  rr(ctx, 262, 184, 500, 348, 16);
  ctx.fill();
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth = 4;
  ctx.stroke();
  text(ctx, 'FLOUR & FIRE', 512, 232, 40, COLORS.terracotta, 'bold', 'center');
  text(ctx, '— Sunrise Bakery —', 512, 262, 20, COLORS.ink, 'bold', 'center');
  text(ctx, 'Toko roti artisan di pagi hari', 512, 288, 15, COLORS.inkSoft, 'normal', 'center');
  drawPastryIcon(ctx, 512, 318, 1.3, 'finished', 'chocolate');
  text(ctx, 'Bake 7 pastries across 3 mornings, 2 ovens,', 512, 352, 14, COLORS.ink, 'normal', 'center');
  text(ctx, 'combos & tips before 10 AM', 512, 372, 14, COLORS.ink, 'normal', 'center');
  text(ctx, 'WASD / Panah gerak  •  Klik stasiun  •  1-4 isian  •  Space interact', 512, 398, 13, COLORS.inkSoft, 'normal', 'center');
  text(ctx, 'MIX adonan  →  FILL isian  →  OVEN panggang  →  FINISH hias  →  SERVE', 512, 420, 13, COLORS.ink, 'bold', 'center');
  ctx.fillStyle = COLORS.terracotta;
  rr(ctx, 362, 438, 300, 44, 10);
  ctx.fill();
  text(ctx, 'PRESS ENTER TO START', 512, 466, 18, COLORS.white, 'bold', 'center');
  text(ctx, 'Target Pagi 1: $150  •  Pagi 2: $130  •  Pagi 3: $90', 512, 500, 12, COLORS.inkSoft, 'normal', 'center');
}

function drawOver(ctx, world, muted) {
  drawPlay(ctx, world, muted);
  ctx.fillStyle = 'rgba(74,50,38,0.5)';
  ctx.fillRect(0, 0, W, H);
  const won = !!world.won;
  ctx.fillStyle = COLORS.cream;
  rr(ctx, 262, 140, 500, 360, 16);
  ctx.fill();
  ctx.strokeStyle = won ? COLORS.sage : COLORS.terracotta;
  ctx.lineWidth = 4;
  ctx.stroke();
  text(ctx, won ? 'BAKERY SAVED!' : 'OUT OF FLOUR...', 512, 208, 40, won ? COLORS.sageDark : COLORS.terracotta, 'bold', 'center');
  text(
    ctx,
    won ? 'Target tercapai sebelum jam 10:00!' : 'Target tidak tercapai — toko tutup hari ini.',
    512,
    244,
    15,
    COLORS.inkSoft,
    'normal',
    'center'
  );
  text(ctx, 'Uang: $' + (world.money || 0) + '  /  Target: $' + (world.target || 0), 512, 292, 20, COLORS.ink, 'bold', 'center');
  text(ctx, 'Pelanggan dilayani: ' + (world.served || 0) + '   •   Kombo terbaik: x' + (world.bestCombo || 0), 512, 326, 15, COLORS.ink, 'normal', 'center');
  text(ctx, 'Skor akhir: ' + (world.score || world.money || 0), 512, 360, 15, COLORS.ink, 'normal', 'center');
  // A won morning offers the next one on Enter; R replays this morning.
  const nextDay = won && (world.day || 1) < 3;
  ctx.fillStyle = COLORS.terracotta;
  rr(ctx, 387, 396, 250, 48, 10);
  ctx.fill();
  text(ctx, nextDay ? 'PRESS ENTER — PAGI ' + ((world.day || 1) + 1) : 'PRESS R TO RETRY', 512, 427, 18, COLORS.white, 'bold', 'center');
  text(
    ctx,
    nextDay ? 'R — ulang pagi ini  •  Enter — lanjut pagi berikut' : 'Enter — main lagi  •  R — ulang pagi ini',
    512,
    474,
    13,
    COLORS.inkSoft,
    'normal',
    'center'
  );
}

// Main entry: draw the whole 1024x640 frame for a screen state.
// screen is one of SCREEN_TITLE / SCREEN_PLAY / SCREEN_OVER.
// world follows the spec section 3 state shape; opts carries the sound and
// pause flags ({ muted, paused }). A bare boolean still works as muted,
// so older callers keep drawing the right sound label.
export function draw(ctx, world, screen, opts) {
  const muted = opts && typeof opts === 'object' ? !!opts.muted : !!opts;
  const paused = opts && typeof opts === 'object' ? !!opts.paused : false;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, W, H);
  if (screen === SCREEN_TITLE) {
    drawTitle(ctx, world, muted);
  } else if (screen === SCREEN_OVER || world.over) {
    drawOver(ctx, world, muted);
  } else {
    drawPlay(ctx, world, muted, paused);
  }
  ctx.restore();
}
