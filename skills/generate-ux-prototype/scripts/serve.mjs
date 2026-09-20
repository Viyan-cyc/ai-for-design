#!/usr/bin/env node
// serve.mjs
// Lightweight HTTP server for offline preview.
// Browsers block file:// dynamic module loading (unique security origin),
// so this server serves the {slug}/ directory on http://localhost:PORT.
//
// Usage:
//   node scripts/serve.mjs --dir "{artifact-folder}/{slug}"
//   node scripts/serve.mjs --dir "{artifact-folder}/{slug}" --port 8765
//
// Output (agent-parseable):
//   RESULT: OK
//   URL: http://localhost:PORT/index.gts.html
//   Press Ctrl+C to stop

import { existsSync, statSync, readFileSync } from 'fs';
import { join, resolve, extname } from 'path';
import { createServer } from 'http';

const args = process.argv.slice(2);
function getOpt(long, short) {
  const idx = args.findIndex((a) => a === long || a === short);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const dir = getOpt('--dir', '-d');
const port = parseInt(getOpt('--port', '-p') || '8765', 10);

if (!dir) {
  console.log('RESULT: FAIL | Usage: node serve.mjs --dir "<folder>" [--port 8765]');
  process.exit(1);
}

const root = resolve(dir);
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.log(`RESULT: FAIL | Directory not found: ${root}`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.less': 'text/plain; charset=utf-8',
  '.vue': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const server = createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (urlPath === '/') urlPath = '/index.gts.html';

  // Prevent path traversal
  const filePath = join(root, urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found: ' + urlPath);
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end('Internal Server Error: ' + e.message);
  }
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/index.gts.html`;
  console.log('RESULT: OK');
  console.log(`URL: ${url}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`RESULT: FAIL | Port ${port} is in use, try --port ${port + 1}`);
  } else {
    console.log(`RESULT: FAIL | ${e.message}`);
  }
  process.exit(1);
});
