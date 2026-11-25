// Flour & Fire — Sunrise Bakery: a tiny static server for local play.
// Serves the game/ folder on http://localhost:8080, nothing else.
// Run it with `node serve.ts`; pass --port N to pick another port.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');

// Small table of the types a browser game actually asks for.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function portFromArgs() {
  const flag = process.argv.find((a) => a.startsWith('--port='));
  if (flag) return Number(flag.slice('--port='.length));
  const at = process.argv.indexOf('--port');
  if (at >= 0 && process.argv[at + 1]) return Number(process.argv[at + 1]);
  return 8080;
}

const port = portFromArgs();

const server = createServer((req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    // Keep every request inside game/: no climbing out with "..".
    const file = resolve(join(root, normalize(path).replace(/^(\.\.[/\\])+/, '')));
    const target = file === root ? join(root, 'index.html') : file;
    if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found\n');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('server error\n');
  }
});

server.listen(port, () => {
  console.log(`Flour & Fire serving game/ at http://localhost:${port}`);
});
