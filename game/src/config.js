// Flour & Fire — Sunrise Bakery: all tuning numbers live here.
// One place to change a price, a timer, or a station's spot on the floor.

// Playfield size in pixels. The canvas is exactly this big, always.
export const FIELD = { width: 1024, height: 640 };

// Warm bakery palette: cream walls, amber wood, terracotta ovens.
export const COLORS = {
  cream: '#FFF6E5',
  paper: '#FDF1D7',
  amber: '#E8A33D',
  amberDark: '#C77F1A',
  terracotta: '#C65D3B',
  terracottaDark: '#9E4527',
  sage: '#7A9B6D',
  sageDark: '#55714B',
  cocoa: '#4A3226',
  cocoaSoft: '#6B4A35',
  flour: '#FFFFFF',
  berry: '#B23A5A',
  custard: '#F2C94C',
  choco: '#5B3A29',
  cinnamon: '#A85B2A',
  gold: '#FFC94D',
};

// Fillings a ticket can ask for. Index 0-3 maps to keys 1-4.
export const FILLINGS = [
  { id: 'chocolate', label: 'Chocolate', color: '#5B3A29' },
  { id: 'berry', label: 'Berry', color: '#B23A5A' },
  { id: 'custard', label: 'Custard', color: '#F2C94C' },
  { id: 'cinnamon', label: 'Cinnamon', color: '#A85B2A' },
];

// The seven pastries. steps lists the stations in order; fill names the
// filling a recipe needs (null = no filling step); finish names the final
// touch (null = straight from oven to the pass).
export const RECIPES = [
  {
    id: 'butter-croissant', name: 'Butter Croissant', price: 6,
    mixTime: 2, bakeTime: 8, finishTime: 0, fill: null, finish: null,
    steps: ['mix', 'bake'],
  },
  {
    id: 'choco-danish', name: 'Choco Danish', price: 8,
    mixTime: 2, bakeTime: 8, finishTime: 0, fill: 'chocolate', finish: null,
    steps: ['mix', 'fill', 'bake'],
  },
  {
    id: 'berry-tart', name: 'Berry Tart', price: 10,
    mixTime: 2, bakeTime: 6, finishTime: 1.5, fill: 'berry', finish: 'glaze',
    steps: ['mix', 'fill', 'bake', 'finish'],
  },
  {
    id: 'cinnamon-roll', name: 'Cinnamon Roll', price: 11,
    mixTime: 2, bakeTime: 10, finishTime: 1.5, fill: 'cinnamon', finish: 'frosting',
    steps: ['mix', 'fill', 'bake', 'finish'],
  },
  {
    id: 'custard-bun', name: 'Custard Bun', price: 9,
    mixTime: 2, bakeTime: 7, finishTime: 0, fill: 'custard', finish: null,
    steps: ['mix', 'fill', 'bake'],
  },
  {
    id: 'sourdough-loaf', name: 'Sourdough Loaf', price: 7,
    mixTime: 3, bakeTime: 12, finishTime: 0, fill: null, finish: null,
    steps: ['mix', 'bake'],
  },
  {
    id: 'choco-croissant', name: 'Choco Croissant', price: 12,
    mixTime: 2, bakeTime: 9, finishTime: 1.5, fill: 'chocolate', finish: 'glaze',
    steps: ['mix', 'fill', 'bake', 'finish'],
  },
];

// Which recipes each morning may order. Morning 1 is gentle, morning 3
// throws the whole menu at the bakery.
export const DAY_RECIPES = [
  ['butter-croissant', 'choco-danish', 'berry-tart'],
  ['butter-croissant', 'choco-danish', 'berry-tart', 'cinnamon-roll', 'custard-bun'],
  ['butter-croissant', 'choco-danish', 'berry-tart', 'cinnamon-roll', 'custard-bun', 'sourdough-loaf', 'choco-croissant'],
];

// Money to earn before 10:00, one target per morning. Morning 1 sets the
// bar high on the three starter pastries; mornings 2-3 ease the target as
// the menu widens and the tickets come faster.
export const DAY_TARGETS = [150, 130, 90];

// Seconds between new tickets arriving, one interval per morning.
export const TICKET_INTERVALS = [14, 11, 10.5];

// Seconds a customer waits before storming out, one value per morning.
export const PATIENCE = [45, 38, 36];

// A shift runs 06:00 to 10:00 in this many real seconds.
export const SHIFT_SECONDS = 240;

// The oven never grows: two slots, whatever the morning.
export const OVEN_SLOTS = 2;

// At most four tickets pinned to the order board at once.
export const MAX_TICKETS = 4;

// Seconds past "ready" before a bake turns to charcoal.
export const BURN_GRACE = 4;

// Chef walking speed, pixels per second.
export const CHEF_SPEED = 260;

// The five work stations, laid out so every one is readable at a glance.
export const STATIONS = [
  { id: 'mix', label: 'MIX', x: 40, y: 170, w: 190, h: 120 },
  { id: 'fill', label: 'FILL', x: 270, y: 170, w: 260, h: 120 },
  { id: 'oven', label: 'OVEN', x: 570, y: 170, w: 220, h: 120 },
  { id: 'finish', label: 'FINISH', x: 40, y: 350, w: 190, h: 120 },
  { id: 'pass', label: 'SERVE', x: 760, y: 350, w: 224, h: 120 },
];

// Where the chef starts each morning, middle of the open floor.
export const CHEF_START = { x: 512, y: 490 };

// Where the three waiting customers stand, above the serving pass.
export const CUSTOMER_SPOTS = [
  { x: 800, y: 300 },
  { x: 890, y: 300 },
  { x: 965, y: 300 },
];
