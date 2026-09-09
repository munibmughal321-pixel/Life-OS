// LifeOS local server
// No dependencies — just Node's built-in modules.
// Run with: node server.js
// Then open: http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;

// Flat structure: everything (index.html, css, js, data.json) lives
// in this same folder as server.js.
const PUBLIC_DIR = __dirname;
const DATA_FILE = path.join(__dirname, 'data.json');
const AUTH_FILE = path.join(__dirname, 'auth.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};

/* ---------- file setup ---------- */
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
  }
}
function ensureAuthFile() {
  if (!fs.existsSync(AUTH_FILE)) {
    // No account field yet = nobody has signed up.
    fs.writeFileSync(AUTH_FILE, JSON.stringify({}, null, 2));
  }
}
function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/* ---------- password hashing (Node's built-in crypto, no deps) ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, storedHashHex) {
  const candidateHash = crypto.scryptSync(password, salt, 64);
  const storedHash = Buffer.from(storedHashHex, 'hex');
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedHash);
}

/* ---------- request body helper ---------- */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { reject(e); }
    });
  });
}
function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

/* ---------- static files ---------- */
function serveStaticFile(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, filePath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + req.url);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(content);
  });
}

/* ---------- app data endpoints ---------- */
function handleGetData(req, res) {
  fs.readFile(DATA_FILE, 'utf8', (err, content) => {
    if (err) return sendJson(res, 500, { error: 'Could not read data file' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(content);
  });
}
async function handleSaveData(req, res) {
  try {
    const parsed = await readBody(req);
    fs.writeFile(DATA_FILE, JSON.stringify(parsed), (err) => {
      if (err) return sendJson(res, 500, { error: 'Could not save data' });
      sendJson(res, 200, { ok: true });
    });
  } catch (e) {
    sendJson(res, 400, { error: 'Invalid JSON' });
  }
}

/* ---------- auth endpoints ---------- */
function handleAuthStatus(req, res) {
  const auth = readJsonFile(AUTH_FILE);
  sendJson(res, 200, { hasAccount: !!auth.username, username: auth.username || null });
}

async function handleSignup(req, res) {
  try {
    const { username, password } = await readBody(req);
    if (!username || !password) return sendJson(res, 400, { error: 'Username and password are required' });

    const auth = readJsonFile(AUTH_FILE);
    if (auth.username) return sendJson(res, 409, { error: 'An account already exists. Please log in instead.' });

    const { salt, hash } = hashPassword(password);
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ username, salt, hash }, null, 2));
    sendJson(res, 200, { ok: true, username });
  } catch (e) {
    sendJson(res, 400, { error: 'Invalid request' });
  }
}

async function handleLogin(req, res) {
  try {
    const { username, password } = await readBody(req);
    if (!username || !password) return sendJson(res, 400, { error: 'Username and password are required' });

    const auth = readJsonFile(AUTH_FILE);
    if (!auth.username) return sendJson(res, 404, { error: 'No account found. Please sign up first.' });
    if (auth.username !== username) return sendJson(res, 401, { error: 'Incorrect username or password' });

    const valid = verifyPassword(password, auth.salt, auth.hash);
    if (!valid) return sendJson(res, 401, { error: 'Incorrect username or password' });

    sendJson(res, 200, { ok: true, username: auth.username });
  } catch (e) {
    sendJson(res, 400, { error: 'Invalid request' });
  }
}

/* ---------- router ---------- */
const server = http.createServer((req, res) => {
  if (req.url === '/api/data' && req.method === 'GET') return handleGetData(req, res);
  if (req.url === '/api/data' && req.method === 'POST') return handleSaveData(req, res);
  if (req.url === '/api/auth/status' && req.method === 'GET') return handleAuthStatus(req, res);
  if (req.url === '/api/auth/signup' && req.method === 'POST') return handleSignup(req, res);
  if (req.url === '/api/auth/login' && req.method === 'POST') return handleLogin(req, res);
  serveStaticFile(req, res);
});

ensureDataFile();
ensureAuthFile();
server.listen(PORT, () => {
  console.log(`LifeOS running at http://localhost:${PORT}`);
});
