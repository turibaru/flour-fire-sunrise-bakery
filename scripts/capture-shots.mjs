// Flour & Fire — Sunrise Bakery: screenshot capture.
// Serves game/ on port 8901, screenshots each scene from shots.json with
// headless Chromium at exactly 1024x640, converts to JPEG quality 85, and
// ASSERTS every output is 1024x640 and <= 256 KiB (fails otherwise).
// Run from the repo root:  node scripts/capture-shots.mjs

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GAME_DIR = path.join(ROOT, 'game');
const SHOTS_DIR = path.join(ROOT, 'screenshots');
const PORT = 8901;
const CHROME =
  process.env.CHROME_PATH ||
  path.join(process.env.HOME || '/home/hatch', '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const MAX_BYTES = 256 * 1024;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  return false;
}

// Minimal static server for game/ (fallback when serve.ts is unavailable).
function startFallbackServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const file = path.join(GAME_DIR, rel);
      if (!file.startsWith(GAME_DIR)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function startServer() {
  // Preferred: the repo's own serve.ts (Builder A), same as the spec.
  const serveTs = path.join(ROOT, 'serve.ts');
  try {
    await fs.access(serveTs);
    const child = spawn('node', ['serve.ts', '--port', String(PORT)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
    const up = await waitForServer(`http://localhost:${PORT}/index.html`, 20);
    if (up) return { close: () => child.kill() };
    child.kill();
  } catch {
    // fall through to the built-in server
  }
  const server = await startFallbackServer();
  const up = await waitForServer(`http://localhost:${PORT}/index.html`);
  if (!up) throw new Error('static server did not come up on port ' + PORT);
  return { close: () => server.close() };
}

async function shotToJpeg(pngPath, jpgPath) {
  // PIL is the local conversion tool (no network installs, no new deps).
  const code = [
    'from PIL import Image',
    `im = Image.open(${JSON.stringify(pngPath)}).convert("RGB")`,
    `im.save(${JSON.stringify(jpgPath)}, "JPEG", quality=85)`,
  ].join('\n');
  await run('python3', ['-c', code]);
}

async function checkShot(jpgPath) {
  const code = [
    'from PIL import Image',
    `im = Image.open(${JSON.stringify(jpgPath)})`,
    'print(im.size[0], im.size[1], im.format)',
  ].join('\n');
  const { stdout } = await run('python3', ['-c', code]);
  const parts = stdout.trim().split(/\s+/);
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  const stat = await fs.stat(jpgPath);
  if (w !== 1024 || h !== 640) {
    throw new Error(`${jpgPath}: expected 1024x640, got ${w}x${h}`);
  }
  if (stat.size > MAX_BYTES) {
    throw new Error(`${jpgPath}: ${stat.size} bytes exceeds 256 KiB`);
  }
  return { width: w, height: h, bytes: stat.size, format: parts[2] };
}

async function main() {
  const shots = JSON.parse(await fs.readFile(path.join(ROOT, 'shots.json'), 'utf8'));
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const server = await startServer();
  const results = [];
  try {
    for (const shot of shots) {
      const tmpPng = path.join(SHOTS_DIR, '.' + shot.name + '.tmp.png');
      const outJpg = path.join(SHOTS_DIR, shot.name);
      const url = `http://localhost:${PORT}/${shot.query.replace(/^\?/, '?')}`;
      await run(CHROME, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--window-size=1024,640',
        '--force-device-scale-factor=1',
        '--screenshot=' + tmpPng,
        url,
      ]);
      await shotToJpeg(tmpPng, outJpg);
      await fs.unlink(tmpPng).catch(() => {});
      const info = await checkShot(outJpg);
      results.push({ name: shot.name, query: shot.query, ...info });
      console.log(`${shot.name}: ${info.width}x${info.height} ${info.format} ${info.bytes} bytes`);
    }
  } finally {
    server.close();
  }
  console.log('capture OK: ' + results.length + ' screenshots');
}

main().catch((err) => {
  console.error('capture FAILED:', err.message);
  process.exit(1);
});
