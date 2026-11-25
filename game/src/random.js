// Seeded dice for the bakery: same seed, same morning, every time.
// Screenshots and replays stay identical because nothing here reads
// Math.random or the clock.

// mulberry32, a small fast seeded generator with a long, even period.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build the morning's dice from a seed number.
export function makeDice(seed) {
  const next = mulberry32(seed);
  return {
    // A float in [0, 1).
    float() {
      return next();
    },
    // A whole number from min to max, both ends included.
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    // One member of a list, picked evenly.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}
