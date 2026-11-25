// Flour & Fire — Sunrise Bakery: the hand-in step.
//
// This file runs under Node 22 with only the standard library. It gathers
// the finished game (game/) and its four screenshots (screenshots/), copies
// both into the output folder the scorer reads, and writes dossier.json
// there — the summary the judge reads — using the vendored make.fun helper.
//
// The grader runs it twice from a read-only copy and expects both runs to
// produce byte-identical output, so everything here is plain copying and
// one deterministic summary. Any failure aborts with a non-zero exit
// instead of leaving a half-built output behind.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The folder this file lives in; the game and screenshots sit beside it.
const here = fileURLToPath(new URL('.', import.meta.url));
// The scorer hands us its output folder; outside its container we fall
// back to /output, or to whatever MAKEFUN_OUTPUT_DIR points at.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

try {
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');

  // Refuse to hand in a game with no front door.
  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html is missing — nothing to hand in.');
  }

  // Start from a clean slate so a stale file can never sneak into the run.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // The playable game, exactly as it sits in this folder.
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });

  // The four screenshots, when they exist yet. The folder is created
  // either way so the summary step below always has somewhere to look.
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  }

  // The judge's summary. The caps below are the scorer's own limits:
  // text is trimmed to 160 KiB, at most four screenshots of at most
  // 256 KiB each, and the game itself stays under 993 files / 48 MiB
  // with no path longer than 1000 bytes. buildDossier refuses anything
  // over those lines, which is exactly what the scorer would refuse.
  // Note the run is deterministic on purpose: the same folder in gives
  // the same dossier out, byte for byte, so the scorer's double run
  // can never disagree with itself.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);

  // Prove the hand-in actually landed before calling it done.
  const written = readFileSync(dossierPath, 'utf8');
  if (written.length === 0 || statSync(dossierPath).size === 0) {
    fail('dossier.json came out empty.');
  }
  console.log(`main.ts: wrote ${dossierPath} (${written.length} bytes)`);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
