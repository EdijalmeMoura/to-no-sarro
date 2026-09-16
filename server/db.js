// ============================================================
// TÔ NO SARRO — Camada de banco (SQLite via node:sqlite)
// O arquivo vive em server/data/sarro.db (fora do git).
// ============================================================

import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES, OPTION_GROUPS, BUILDER, PRODUCTS, COUPONS,
  DRIVERS, CUSTOMERS, INVENTORY, PROMOS, USERS, SETTINGS,
} from "./data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "sarro.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const fresh = process.argv.includes("--reset");
if (fresh && fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);

export const db = new DatabaseSync(DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    driver_id TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, icon TEXT, pos INTEGER
  );

  CREATE TABLE IF NOT EXISTS option_groups (
    id TEXT PRIMARY KEY, name TEXT, min INTEGER DEFAULT 0, max INTEGER DEFAULT 1, required INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS options (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES option_groups(id),
    name TEXT, price REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS builder_groups (
    id TEXT PRIMARY KEY, label TEXT, pos INTEGER
  );

  CREATE TABLE IF NOT EXISTS builder_options (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES builder_groups(id),
    name TEXT, price REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cat TEXT NOT NULL,
    emoji TEXT,
    description TEXT,
    ingredients TEXT DEFAULT '[]',
    price REAL NOT NULL,
    promo REAL,
    time INTEGER DEFAULT 15,
    badges TEXT DEFAULT '[]',
    available INTEGER DEFAULT 1,
    groups TEXT DEFAULT '[]',
    stock INTEGER DEFAULT 0,
    builder INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, name TEXT, phone TEXT, orders INTEGER DEFAULT 0,
    spent REAL DEFAULT 0, last TEXT, tier TEXT DEFAULT 'Novo', addr TEXT, points INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY, name TEXT, phone TEXT, vehicle TEXT, status TEXT, deliveries INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS coupons (
    code TEXT PRIMARY KEY, type TEXT, value REAL, min REAL DEFAULT 0,
    uses INTEGER DEFAULT 0, max_uses INTEGER, active INTEGER DEFAULT 1, note TEXT
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY, name TEXT, unit TEXT, qty REAL, min REAL
  );

  CREATE TABLE IF NOT EXISTS promos (
    id TEXT PRIMARY KEY, name TEXT, rule TEXT, active INTEGER DEFAULT 1, window TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code INTEGER UNIQUE NOT NULL,
    channel TEXT DEFAULT 'DIRECT',
    status TEXT DEFAULT 'NOVO',
    created_at INTEGER,
    started_at INTEGER,
    driver_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_addr TEXT,
    payment TEXT,
    type TEXT DEFAULT 'delivery',
    note TEXT,
    subtotal REAL DEFAULT 0,
    fee REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT, name TEXT, emoji TEXT,
    qty INTEGER, unit REAL, opts TEXT DEFAULT '[]', note TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE IF NOT EXISTS integration_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER,
    channel TEXT,
    level TEXT,
    msg TEXT
  );

  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    at INTEGER,
    to_phone TEXT,
    event TEXT,
    body TEXT,
    order_code INTEGER,
    status TEXT DEFAULT 'fila',
    error TEXT,
    attempts INTEGER DEFAULT 0,
    sent_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider TEXT DEFAULT 'infinitepay',
    order_nsu TEXT,
    invoice_slug TEXT,
    transaction_nsu TEXT,
    url TEXT,
    status TEXT DEFAULT 'pendente',
    capture_method TEXT,
    amount INTEGER,
    paid_amount INTEGER,
    receipt_url TEXT,
    created_at INTEGER,
    paid_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER, user TEXT, action TEXT, detail TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`);

// Migrações leves: adiciona colunas novas em bancos já existentes
function addColumnIfMissing(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
addColumnIfMissing("products", "img", "img TEXT");
addColumnIfMissing("products", "updated_at", "updated_at INTEGER DEFAULT 0");
addColumnIfMissing("orders", "payment_status", "payment_status TEXT DEFAULT ('indefinido')");
addColumnIfMissing("orders", "ext_ref", "ext_ref TEXT");

function getSettingRaw(key) {
  try { return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value; } catch { return undefined; }
}
function setSettingRaw(key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

// Segredo do webhook de pagamento (nasce uma vez, fica só no servidor)
if (!getSettingRaw("pay_webhook_secret")) {
  setSettingRaw("pay_webhook_secret", crypto.randomBytes(12).toString("hex"));
}

export function audit(user, action, detail = "") {
  db.prepare("INSERT INTO audit_logs (at, user, action, detail) VALUES (?, ?, ?, ?)")
    .run(Date.now(), user || "sistema", action, String(detail).slice(0, 500));
}

// ------------------------------------------------------------
// Semente — só povoa se o banco estiver vazio
// ------------------------------------------------------------
export function seedIfEmpty() {
  const n = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
  if (n > 0) return false;

  const now = Date.now();

  const insUser = db.prepare("INSERT INTO users (id, name, username, pass_hash, role, driver_id) VALUES (?, ?, ?, ?, ?, ?)");
  for (const u of USERS) {
    insUser.run(u.id, u.name, u.username, bcrypt.hashSync(u.password, 10), u.role, u.driver_id);
  }

  const insCat = db.prepare("INSERT INTO categories (id, label, icon, pos) VALUES (?, ?, ?, ?)");
  CATEGORIES.forEach((c, i) => insCat.run(c.id, c.label, c.icon, i));

  const insGroup = db.prepare("INSERT INTO option_groups (id, name, min, max, required) VALUES (?, ?, ?, ?, ?)");
  const insOpt = db.prepare("INSERT INTO options (id, group_id, name, price) VALUES (?, ?, ?, ?)");
  for (const g of OPTION_GROUPS) {
    insGroup.run(g.id, g.name, g.min, g.max, g.required);
    for (const o of g.options) insOpt.run(o.id, g.id, o.name, o.price);
  }

  const insBGroup = db.prepare("INSERT INTO builder_groups (id, label, pos) VALUES (?, ?, ?)");
  const insBOpt = db.prepare("INSERT INTO builder_options (id, group_id, name, price) VALUES (?, ?, ?, ?)");
  BUILDER.forEach((g, i) => {
    insBGroup.run(g.id, g.label, i);
    for (const o of g.options) insBOpt.run(o.id, g.id, o.name, o.price);
  });

  const insProd = db.prepare(`
    INSERT INTO products (id, name, cat, emoji, description, ingredients, price, promo, time, badges, available, groups, stock, builder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of PRODUCTS) {
    insProd.run(p.id, p.name, p.cat, p.emoji, p.desc, JSON.stringify(p.ingredients),
      p.price, p.promo, p.time, JSON.stringify(p.badges), p.available,
      JSON.stringify(p.groups), p.stock, p.builder);
  }

  const insCust = db.prepare("INSERT INTO customers (id, name, phone, orders, spent, last, tier, addr, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const c of CUSTOMERS) insCust.run(c.id, c.name, c.phone, c.orders, c.spent, c.last, c.tier, c.addr, c.points);

  const insDrv = db.prepare("INSERT INTO drivers (id, name, phone, vehicle, status, deliveries) VALUES (?, ?, ?, ?, ?, ?)");
  for (const d of DRIVERS) insDrv.run(d.id, d.name, d.phone, d.vehicle, d.status, d.deliveries);

  const insCoup = db.prepare("INSERT INTO coupons (code, type, value, min, uses, max_uses, active, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const c of COUPONS) insCoup.run(c.code, c.type, c.value, c.min, c.uses, c.max_uses, c.active, c.note);

  const insInv = db.prepare("INSERT INTO inventory (id, name, unit, qty, min) VALUES (?, ?, ?, ?, ?)");
  for (const i of INVENTORY) insInv.run(i.id, i.name, i.unit, i.qty, i.min);

  const insPromo = db.prepare("INSERT INTO promos (id, name, rule, active, window) VALUES (?, ?, ?, ?, ?)");
  for (const p of PROMOS) insPromo.run(p.id, p.name, p.rule, p.active, p.window);

  const insSet = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(SETTINGS)) insSet.run(k, String(v));

  // Pedidos de demonstração para os painéis nascerem com movimento
  const insOrder = db.prepare(`
    INSERT INTO orders (id, code, channel, status, created_at, started_at, driver_id, customer_name, customer_phone, customer_addr, payment, type, note, subtotal, fee, discount, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 0, ?)
  `);
  const insItem = db.prepare("INSERT INTO order_items (id, order_id, product_id, name, emoji, qty, unit, opts, note) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '')");
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const t0 = Date.now();
  const demo = [
    ["Marina Costa", "(81) 98877-1020", "Av. Cláudio J. Gueiros, 1500 — Maria Farinha", "IFOOD", "NOVO", 4, "Cartão (iFood)", "delivery", [["p1", 2]], 0],
    ["João Silva", "(81) 99123-4567", "Rua das Palmeiras, 220 — Janga, Paulista/PE", "DIRECT", "PREPARO", 9, "PIX", "delivery", [["p6", 1], ["p8", 1]], 0],
    ["Pedro Henrique", "(81) 99555-3311", "Retirada na loja", "WHATSAPP", "PRONTO", 14, "Dinheiro", "pickup", [["p3", 1]], 0],
    ["Ana Beatriz", "(81) 98220-7744", "Rua Boa Viagem, 88 — Casa Caiada, Olinda", "NNFOOD", "AGUARDANDO", 19, "Cartão (99Food)", "delivery", [["p12", 2], ["p14", 1]], 0],
    ["Carlos Mendes", "(81) 99801-4455", "Rua Nova, 12 — Rio Doce", "DIRECT", "ROTA", 27, "PIX", "delivery", [["p2", 1], ["p9", 1], ["p11", 1]], 2],
    ["Lucas Andrade", "(81) 99333-1200", "Rua do Sol, 45 — Pau Amarelo", "DIRECT", "ENTREGUE", 52, "Cartão", "delivery", [["p7", 1]], 2],
  ];
  demo.forEach(([name, phone, addr, channel, status, minsAgo, payment, type, prods, driverIdx], i) => {
    const oid = `seed-o${i + 1}`;
    const created = t0 - minsAgo * 60000;
    let subtotal = 0;
    for (const [pid, qty] of prods) {
      const p = byId[pid];
      subtotal += (p.promo ?? p.price) * qty;
    }
    const fee = type === "pickup" ? 0 : SETTINGS.fee;
    const total = subtotal + fee;
    insOrder.run(oid, 1042 + i, channel, status, created, created + 90000,
      driverIdx ? DRIVERS[driverIdx].id : null, name, phone, addr, payment, type, subtotal, fee, total);
    for (const [pid, qty] of prods) {
      const p = byId[pid];
      insItem.run(crypto.randomUUID(), oid, p.id, p.name, p.emoji, qty, p.promo ?? p.price);
    }
  });

  audit("sistema", "seed", "Banco populado com o catálogo inicial");
  console.log(`[db] Banco semeado em ${DB_FILE} (${new Date(now).toLocaleString("pt-BR")})`);
  return true;
}

// ------------------------------------------------------------
// Leitura do catálogo/estado no formato que o frontend consome
// ------------------------------------------------------------
const jparse = (s, fb = []) => { try { return JSON.parse(s ?? "") ?? fb; } catch { return fb; } };

export function logIntegration(channel, level, msg) {
  db.prepare("INSERT INTO integration_logs (at, channel, level, msg) VALUES (?, ?, ?, ?)")
    .run(Date.now(), channel, level, String(msg).slice(0, 400));
  // mantém o diário enxuto
  db.prepare("DELETE FROM integration_logs WHERE id < (SELECT COALESCE(MAX(id),0) - 500 FROM integration_logs)").run();
}

export function getIntegrationLogs(limit = 60) {
  return db.prepare("SELECT * FROM integration_logs ORDER BY id DESC LIMIT ?").all(limit)
    .map((l) => ({ id: l.id, at: l.at, channel: l.channel, level: l.level, msg: l.msg }));
}

export function enqueueWhatsApp({ to, event, body, code }) {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO outbox (id, at, to_phone, event, body, order_code) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, Date.now(), to, event, body, code || null);
  // mantém a fila enxuta
  db.prepare("DELETE FROM outbox WHERE id NOT IN (SELECT id FROM outbox ORDER BY at DESC LIMIT 100)").run();
  return id;
}

export function markOutbox(id, status, error) {
  db.prepare("UPDATE outbox SET status = ?, error = ?, attempts = attempts + 1, sent_at = ? WHERE id = ?")
    .run(status, error ? String(error).slice(0, 200) : null, status === "enviada" ? Date.now() : null, id);
}

export function getOutbox(limit = 30) {
  return db.prepare("SELECT * FROM outbox ORDER BY at DESC LIMIT ?").all(limit)
    .map((m) => ({ id: m.id, at: m.at, to: m.to_phone, event: m.event, body: m.body, code: m.order_code, status: m.status, error: m.error }));
}

export function getProducts() {
  return db.prepare("SELECT * FROM products ORDER BY rowid").all().map((p) => ({
    id: p.id, name: p.name, cat: p.cat, emoji: p.emoji, desc: p.description,
    ingredients: jparse(p.ingredients), price: p.price, promo: p.promo,
    time: p.time, badges: jparse(p.badges), available: !!p.available,
    groups: jparse(p.groups), stock: p.stock, builder: !!p.builder,
    img: p.img || null, updatedAt: p.updated_at || 0,
  }));
}

export function getOptionGroups() {
  const groups = db.prepare("SELECT * FROM option_groups ORDER BY rowid").all();
  const opts = db.prepare("SELECT * FROM options ORDER BY rowid").all();
  return groups.map((g) => ({
    id: g.id, name: g.name, min: g.min, max: g.max, required: !!g.required,
    options: opts.filter((o) => o.group_id === g.id).map((o) => ({ id: o.id, name: o.name, price: o.price })),
  }));
}

export function getBuilder() {
  const groups = db.prepare("SELECT * FROM builder_groups ORDER BY pos").all();
  const opts = db.prepare("SELECT * FROM builder_options ORDER BY rowid").all();
  return groups.map((g) => ({
    id: g.id, label: g.label,
    options: opts.filter((o) => o.group_id === g.id).map((o) => ({ id: o.id, name: o.name, price: o.price })),
  }));
}

export function getCategories() {
  return db.prepare("SELECT * FROM categories ORDER BY pos").all()
    .map((c) => ({ id: c.id, label: c.label, icon: c.icon }));
}

export function getCoupons() {
  return db.prepare("SELECT * FROM coupons ORDER BY code").all()
    .map((c) => ({ code: c.code, type: c.type, value: c.value, min: c.min, uses: c.uses, limit: c.max_uses, active: !!c.active, note: c.note }));
}

export function getDrivers() {
  return db.prepare("SELECT * FROM drivers ORDER BY id").all()
    .map((d) => ({ id: d.id, name: d.name, phone: d.phone, vehicle: d.vehicle, status: d.status, deliveries: d.deliveries }));
}

export function getCustomers() {
  return db.prepare("SELECT * FROM customers ORDER BY spent DESC").all()
    .map((c) => ({ id: c.id, name: c.name, phone: c.phone, orders: c.orders, spent: c.spent, last: c.last, tier: c.tier, addr: c.addr, points: c.points }));
}

export function getInventory() {
  return db.prepare("SELECT * FROM inventory ORDER BY id").all()
    .map((i) => ({ id: i.id, name: i.name, unit: i.unit, qty: i.qty, min: i.min }));
}

export function getPromos() {
  return db.prepare("SELECT * FROM promos ORDER BY id").all()
    .map((p) => ({ id: p.id, name: p.name, rule: p.rule, active: !!p.active, window: p.window }));
}

export function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return {
    storeName: s.store_name,
    open: s.open === "1",
    fee: parseFloat(s.fee),
    minOrder: parseFloat(s.min_order),
    eta: s.eta,
    whatsapp: s.whatsapp,
    address: s.address,
    hours: s.hours,
    payHandle: s.pay_handle || "",
    appBaseUrl: s.app_base_url || "",
  };
}

// Uso interno do servidor (inclui o segredo do webhook)
export function getPaymentSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    payHandle: s.pay_handle || "",
    appBaseUrl: s.app_base_url || "",
    webhookSecret: s.pay_webhook_secret || "",
  };
}

export function getSetting(key) {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return r?.value;
}

export function setSetting(key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, String(value));
}

export function getOrders() {
  const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all();
  const items = db.prepare("SELECT * FROM order_items").all();
  const byOrder = new Map();
  for (const it of items) {
    if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
    byOrder.get(it.order_id).push({
      id: it.id, productId: it.product_id, name: it.name, emoji: it.emoji,
      qty: it.qty, unit: it.unit, opts: jparse(it.opts), note: it.note || "",
    });
  }
  const pays = new Map();
  for (const p of db.prepare("SELECT * FROM payments").all()) pays.set(p.order_id, p);

  return rows.map((o) => {
    const pay = pays.get(o.id);
    return {
      id: o.id, code: o.code, channel: o.channel, status: o.status,
      createdAt: o.created_at, startedAt: o.started_at, driverId: o.driver_id,
      customer: { name: o.customer_name, phone: o.customer_phone, addr: o.customer_addr },
      payment: o.payment, type: o.type, note: o.note || "",
      subtotal: o.subtotal, fee: o.fee, discount: o.discount, total: o.total,
      paymentStatus: o.payment_status || "indefinido",
      payUrl: pay?.status === "pendente" ? pay.url : null,
      receiptUrl: pay?.receipt_url || null,
      items: byOrder.get(o.id) || [],
    };
  });
}
