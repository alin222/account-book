const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 8888;
const BASE = process.env.BASE || '/qt';
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
[DATA_DIR, UPLOAD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(express.json({ limit: '50mb' }));

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ============ Router mounted at BASE path ============
const router = express.Router();

// Static files
router.use(express.static(__dirname));
router.use('/uploads', express.static(UPLOAD_DIR));

// ============ File-based data helpers ============
function readJSON(filename) {
  const file = path.join(DATA_DIR, filename);
  if (!fs.existsSync(file)) return filename === 'accounts.json' ? [] : [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch (e) { return filename === 'accounts.json' ? [] : []; }
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ============ API: Accounts ============
router.get('/api/accounts', (req, res) => {
  res.json(readJSON('accounts.json'));
});

router.post('/api/accounts', (req, res) => {
  const accounts = readJSON('accounts.json');
  const account = { id: uid(), name: '', members: [], createdAt: Date.now(), ...req.body };
  accounts.push(account);
  writeJSON('accounts.json', accounts);
  res.json(account);
});

router.put('/api/accounts/:id', (req, res) => {
  const accounts = readJSON('accounts.json');
  const idx = accounts.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '账户不存在' });
  accounts[idx] = { ...accounts[idx], ...req.body, id: req.params.id };
  writeJSON('accounts.json', accounts);
  res.json(accounts[idx]);
});

router.delete('/api/accounts/:id', (req, res) => {
  let accounts = readJSON('accounts.json');
  const exists = accounts.find(a => a.id === req.params.id);
  if (!exists) return res.status(404).json({ error: '账户不存在' });
  accounts = accounts.filter(a => a.id !== req.params.id);
  writeJSON('accounts.json', accounts);
  let bills = readJSON('bills.json');
  bills = bills.filter(b => b.accountId !== req.params.id);
  writeJSON('bills.json', bills);
  res.json({ success: true });
});

// ============ API: Bills ============
router.get('/api/bills', (req, res) => {
  let bills = readJSON('bills.json');
  if (req.query.accountId) {
    bills = bills.filter(b => b.accountId === req.query.accountId);
  }
  res.json(bills);
});

router.post('/api/bills', (req, res) => {
  const bills = readJSON('bills.json');
  const bill = { id: uid(), accountId: '', type: 'expense', amount: 0, date: '', source: '', note: '', image: null, createdAt: Date.now(), ...req.body };
  bills.push(bill);
  writeJSON('bills.json', bills);
  res.json(bill);
});

router.put('/api/bills/:id', (req, res) => {
  const bills = readJSON('bills.json');
  const idx = bills.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '账单不存在' });
  bills[idx] = { ...bills[idx], ...req.body, id: req.params.id };
  writeJSON('bills.json', bills);
  res.json(bills[idx]);
});

router.delete('/api/bills/:id', (req, res) => {
  let bills = readJSON('bills.json');
  bills = bills.filter(b => b.id !== req.params.id);
  writeJSON('bills.json', bills);
  res.json({ success: true });
});

// ============ API: Image upload ============
router.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未选择文件' });
  res.json({ url: BASE + '/uploads/' + req.file.filename });
});

// ============ API: Bulk operations ============
router.post('/api/accounts/bulk', (req, res) => {
  const accounts = req.body.accounts || [];
  writeJSON('accounts.json', accounts);
  res.json({ success: true, count: accounts.length });
});

router.post('/api/bills/bulk', (req, res) => {
  const bills = req.body.bills || [];
  writeJSON('bills.json', bills);
  res.json({ success: true, count: bills.length });
});

// ============ SPA fallback ============
router.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Mount everything under BASE path
app.use(BASE, router);

app.listen(PORT, '0.0.0.0', () => {
  console.log('🪰 蜻蜓账本服务器已启动');
  console.log('   本地访问: http://localhost:' + PORT + BASE);
  console.log('   局域网访问: http://' + getLocalIP() + ':' + PORT + BASE);
  console.log('   数据目录: ' + DATA_DIR);
});

function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}
