#!/usr/bin/env node
// Standalone mock IconPlus service for the INDEPENDENT project build evidence.
// Serves the three documented endpoints so fetch-icons can produce a MIXED
// barrel (some company icons + some Element Plus fallbacks) entirely offline.
//
// Usage: node mock-icon-server.mjs [port]   → prints  LISTENING <port>
import http from 'http';

const port = parseInt(process.argv[2] || '0', 10);
const svg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${c}" d="M4 4h16v16H4z"/></svg>`;
const HITS = new Set(['Search', 'Plus']);   // names the mock "knows" (company assets)

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (v) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(v)); };
  if (url.pathname.endsWith('/getConfig')) {
    return json({ size: [{ key: '24' }], style: [{ key: 'border', value: '线性' }], colors: [{ style: '线性', id: 'c1' }] });
  }
  if (url.pathname.endsWith('/getIconInfo')) {
    const kws = (url.searchParams.get('keyword') || '').split(',').filter(Boolean);
    return json(kws.map((kw) => ({ keyword: kw, icons: HITS.has(kw) ? [{ englishName: kw, url: `mock://${kw}`, icon_id: `id-${kw}`, score: 0.5 }] : [] })));
  }
  if (url.pathname.endsWith('/getIcon')) {
    const theme = url.searchParams.get('theme');
    const urls = (url.searchParams.get('url') || '').split(',').filter(Boolean);
    return json(urls.map((u) => ({ url: u, data: svg(theme === 'dark' ? '#dddddd' : '#222222') })));
  }
  res.writeHead(404); res.end();
});
server.listen(port, '127.0.0.1', () => console.log(`LISTENING ${server.address().port}`));
