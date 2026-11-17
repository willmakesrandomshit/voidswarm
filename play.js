#!/usr/bin/env node
// Zero-dependency launcher: serves the game and opens it in your default browser.
const http = require('http'), fs = require('fs'), path = require('path'), { exec } = require('child_process');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const root = __dirname;

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d);
  });
});

function listen(port) {
  server.once('error', e => { if (e.code === 'EADDRINUSE') listen(port + 1); else throw e; });
  server.listen(port, '127.0.0.1', () => {
    const url = 'http://localhost:' + server.address().port + '/';
    console.log('VOIDSWARM running at ' + url + '  (Ctrl+C to quit)');
    if (process.env.NO_OPEN) return;
    const cmd = process.platform === 'win32' ? 'start "" "' + url + '"' : process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
    exec(cmd, () => { });
  });
}
listen(+process.env.PORT || 8080);
