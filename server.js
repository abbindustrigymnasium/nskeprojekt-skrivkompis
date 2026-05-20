const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
// Aixia LLM API-nyckel (test med en av de tillhandahållna)
const OPENAI_API_KEY = 'sk-ANsvAd3cf2U4a69bC2avOQ';
const PUBLIC_DIR = path.resolve(__dirname);

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain',
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File not found');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function proxyOpenAI(req, res) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('sk-JKVPhL8DGwfdzxMstj1IJg')) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'OpenAI API key is not configured. Update server.js with a valid key.' }));
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    console.log('Forwarding request to Aixia LLM...');
    const options = {
      hostname: 'llm.aiqu.ai',
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-litellm-api-key': OPENAI_API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const apiReq = https.request(options, apiRes => {
      res.writeHead(apiRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      apiRes.pipe(res);
    });

    apiReq.on('error', err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    apiReq.write(body);
    apiReq.end();
  });
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = url.parse(req.url);
  const safePath = decodeURIComponent(parsedUrl.pathname);

  if (req.method === 'POST' && safePath === '/openai/chat') {
    return proxyOpenAI(req, res);
  }

  let filePath = path.join(PUBLIC_DIR, safePath);
  if (safePath === '/' || safePath === '') {
    filePath = path.join(PUBLIC_DIR, 'index (1).html');
  }

  filePath = path.normalize(filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('File not found');
  }

  if (fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
  console.log('Open index (1).html in your browser after setting your API key in server.js.');
});
