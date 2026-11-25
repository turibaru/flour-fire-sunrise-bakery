[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![make.fun · best-cooking-game-20261125-0137 rank](https://make.fun/badge/best-cooking-game-20261125-0137/turibaru/flour-fire-sunrise-bakery/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![make.fun · best-cooking-game-20261125-0137 reward](https://make.fun/badge/best-cooking-game-20261125-0137/turibaru/flour-fire-sunrise-bakery/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

# Flour & Fire — Sunrise Bakery

Run a small artisan bakery at sunrise. Customers arrive with order tickets,
and you mix the dough, pick the filling, bake it in one of two ovens, add the
finishing touch, and serve it before the customer's patience runs out. Earn
enough before 10:00 to save the bakery — across three mornings, with seven
pastries, faster customers, and shorter tempers each day.

## How to play

- **Move** with WASD or the arrow keys, or click a station to walk there.
- **Interact** with Space or E: start mixing, load or unload the oven, finish
  a bake, serve a plate.
- **Pick a filling** with keys 1–4 (chocolate, berry, custard, cinnamon).
- **M** mutes the sound, **P** pauses, **Enter** starts, **R** restarts.
  Winning a morning offers the next one on **Enter** (morning 1 → 2 → 3).
- Daily targets: **$150** on morning 1, **$130** on morning 2, **$90** on
  morning 3 — earn the target before 10:00 to save the bakery.
- Watch the ovens: a bake dings when it is ready, and four seconds later it
  burns — binned, and that pastry starts over from the dough.
- Serve fast for bigger tips, and chain serves for a combo multiplier (x2,
  then x3).

## The menu

Butter Croissant ($6), Choco Danish ($8), Berry Tart ($10), Cinnamon Roll
($11), Custard Bun ($9), Sourdough Loaf ($7), and Choco Croissant ($12) —
each with its own mix, fill, bake, and finish steps.

## Run it locally

Requires **Node.js 22.18+ (or 24+)** — `serve.ts` and `main.ts` run through
Node's built-in type stripping, so no build step or install is needed.

```sh
node serve.ts
```

Then open <http://localhost:8080>. The game is plain Canvas 2D with
synthesized WebAudio sounds — no external assets, no network, no downloads.
