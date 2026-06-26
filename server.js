const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildSystemPrompt, callOpenAI } = require('./api/chat');

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

const server = http.createServer(async (req, res) => {
  /* ── /api/chat ── */
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', async () => {
      try {
        const { messages } = JSON.parse(body);
        const systemPrompt = buildSystemPrompt();
        const reply = await callOpenAI(systemPrompt, messages);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  /* ── static files ── */
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);

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
