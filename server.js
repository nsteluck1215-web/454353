require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

const chatHandler = require('./api/chat');
const leadHandler = require('./api/lead');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.md':   'text/markdown; charset=utf-8',
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

/* req.body를 채워주는 래퍼 — Vercel과 인터페이스 통일 */
function makeRes(res) {
  return {
    status(code) { this._code = code; return this; },
    json(obj) {
      res.writeHead(this._code || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    },
    _code: 200,
  };
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  /* ── API 라우트 ── */
  if (req.method === 'POST' && (url === '/api/chat' || url === '/api/lead')) {
    try {
      req.body = await parseBody(req);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    const fakeRes = makeRes(res);
    if (url === '/api/chat') return chatHandler(req, fakeRes);
    if (url === '/api/lead') return leadHandler(req, fakeRes);
  }

  /* ── 정적 파일 ── */
  let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`LSY 마케팅 서버 실행 중 → http://localhost:${PORT}`);
});
