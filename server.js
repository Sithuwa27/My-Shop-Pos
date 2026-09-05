import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'server-data');
const DB_FILE = path.join(DATA_DIR, 'accounts.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const loadDb = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return { users: {} }; } };
const saveDb = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const hash = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
const makePassword = (password) => { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hash(password, salt) }; };
const verifyPassword = (password, rec) => crypto.timingSafeEqual(Buffer.from(hash(password, rec.salt), 'hex'), Buffer.from(rec.hash, 'hex'));
const cleanUsername = (u) => String(u || '').trim().toLowerCase();
const defaultSnapshot = () => ({ business: null, products: [], invoices: [], repairs: [] });

const app = express();
app.use(express.json({ limit: '20mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'my-pos', time: Date.now() }));

app.post('/api/auth/login', (req, res) => {
  const username = cleanUsername(req.body.username);
  const password = String(req.body.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const db = loadDb();
  let account = db.users[username];

  // First login creates the account. This also migrates an existing local POS to the cloud.
  if (!account) {
    const p = makePassword(password);
    account = { username, name: username === 'brave' ? 'POS Admin' : username, role: 'admin', password: p, token: crypto.randomBytes(32).toString('hex'), snapshot: req.body.localSnapshot || defaultSnapshot() };
    db.users[username] = account;
    saveDb(db);
  } else if (!verifyPassword(password, account.password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  if (!account.token) { account.token = crypto.randomBytes(32).toString('hex'); saveDb(db); }
  res.json({ token: account.token, user: { username: account.username, name: account.name, role: account.role }, snapshot: account.snapshot || defaultSnapshot() });
});

const auth = (req, res, next) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const db = loadDb();
  const account = Object.values(db.users).find((u) => u.token === token);
  if (!account) return res.status(401).json({ error: 'Not authenticated.' });
  req.account = account; req.db = db; next();
};

app.put('/api/auth/credentials', auth, (req, res) => {
  const username = cleanUsername(req.body.username);
  const password = String(req.body.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  if (username !== req.account.username && req.db.users[username]) return res.status(409).json({ error: 'Username already exists.' });
  const p = makePassword(password);
  const oldUsername = req.account.username;
  req.account.username = username;
  req.account.password = p;
  req.account.token = crypto.randomBytes(32).toString('hex');
  if (oldUsername !== username) { delete req.db.users[oldUsername]; req.db.users[username] = req.account; }
  saveDb(req.db);
  res.json({ ok: true, token: req.account.token });
});

app.get('/api/data', auth, (req, res) => res.json(req.account.snapshot || defaultSnapshot()));
app.put('/api/data', auth, (req, res) => {
  req.account.snapshot = {
    business: req.body.business || null,
    products: Array.isArray(req.body.products) ? req.body.products.slice(0, 2000) : [],
    invoices: Array.isArray(req.body.invoices) ? req.body.invoices.slice(0, 500) : [],
    repairs: Array.isArray(req.body.repairs) ? req.body.repairs.slice(0, 500) : [],
  };
  saveDb(req.db);
  res.json({ ok: true, updatedAt: Date.now() });
});

const dist = path.join(__dirname, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => console.log(`POS server running on port ${PORT}`));
