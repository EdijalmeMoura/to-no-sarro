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
import { generatePixBRCode } from "./payments/pix.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Em produção (ex.: Render Disk), aponte DATA_DIR para o volume persistente
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "sarro.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const fresh = process.argv.includes("--reset");
if (fresh && fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);

let db;
try {
  db = new DatabaseSync(DB_FILE);
} catch (e) {
  console.error(`[db] Falha ao abrir ${DB_FILE}: ${e.message}`);
  console.error("[db] node:sqlite exige Node ≥ 22.13. No Render, pinhe NODE_VERSION=22 (veja .node-version).");
  throw e;
}
export { db };

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    driver_id TEXT,
    active INTEGER DEFAULT 1,
    last_login_at INTEGER
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
    id TEXT PRIMARY KEY, name TEXT, rule TEXT, active INTEGER DEFAULT 1, window TEXT,
    starts_at INTEGER, ends_at INTEGER
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

  CREATE TABLE IF NOT EXISTS cash_registers (
    id TEXT PRIMARY KEY,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER,
    opened_by TEXT NOT NULL,
    closed_by TEXT,
    initial_cash REAL NOT NULL DEFAULT 0,
    closed_cash REAL,
    declared_pix REAL,
    declared_card REAL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS cash_transactions (
    id TEXT PRIMARY KEY,
    register_id TEXT NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'DINHEIRO',
    amount REAL NOT NULL,
    order_id TEXT,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_cash_reg_status ON cash_registers(status);
  CREATE INDEX IF NOT EXISTS idx_cash_tx_reg ON cash_transactions(register_id);

  CREATE TABLE IF NOT EXISTS driver_settlements (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL REFERENCES drivers(id),
    created_at INTEGER NOT NULL,
    settled_by TEXT NOT NULL,
    deliveries_count INTEGER NOT NULL,
    total_fees REAL NOT NULL,
    base_pay REAL NOT NULL DEFAULT 0,
    total_cash_collected REAL NOT NULL,
    net_balance REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'SETTLED',
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_settle_driver ON driver_settlements(driver_id);
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
addColumnIfMissing("orders", "track_token", "track_token TEXT");
addColumnIfMissing("orders", "route_id", "route_id TEXT");
addColumnIfMissing("orders", "route_seq", "route_seq INTEGER DEFAULT 1");
addColumnIfMissing("orders", "settlement_id", "settlement_id TEXT");
addColumnIfMissing("orders", "table_number", "table_number INTEGER");
addColumnIfMissing("orders", "table_name", "table_name TEXT");
addColumnIfMissing("users", "active", "active INTEGER DEFAULT 1");
addColumnIfMissing("users", "last_login_at", "last_login_at INTEGER");
addColumnIfMissing("promos", "starts_at", "starts_at INTEGER");
addColumnIfMissing("promos", "ends_at", "ends_at INTEGER");

// Migração de dados: cardápio real da loja (nomes, preços e pão brioche).
// Só atualiza as linhas ainda iguais à semente fictícia — qualquer edição
// feita pelo admin no Cardápio é preservada. Também carimba updated_at
// para o app buscar as fotos novas (cache-busting do ?v=).
// Migração do pão e fotos novas (atualiza ingredientes e força novo timestamp updated_at)
try {
  db.prepare(`UPDATE builder_options SET name = 'Pão Brioche Artesanal Amarelo (c/ gergelim preto)' WHERE id = 'brioche'`).run();
  const prods = [
    { id: "p1", desc: "100g de carne no pão brioche artesanal amarelo com gergelim preto, salada fresca e molho especial.", ing: ["Pão brioche amarelo c/ gergelim preto", "Carne 100g", "Alface", "Tomate", "Cebola roxa", "Molho especial"] },
    { id: "p2", desc: "100g de carne, bacon crocante e creme cheddar no pão brioche artesanal amarelo.", ing: ["Pão brioche amarelo c/ gergelim preto", "Carne 100g", "Bacon crocante", "Creme cheddar", "Molho especial"] },
    { id: "p3", desc: "100g de carne com calabresa fatiada e creme cheddar no pão brioche artesanal amarelo.", ing: ["Pão brioche amarelo c/ gergelim preto", "Carne 100g", "Calabresa fatiada", "Creme cheddar", "Molho especial"] },
    { id: "p4", desc: "100g de carne com desmantelo de creme cheddar cascata no pão brioche amarelo.", ing: ["Pão brioche amarelo c/ gergelim preto", "Carne 100g", "Desmantelo de creme cheddar", "Molho especial"] },
    { id: "p5", desc: "100g de carne com fatia grossa de queijo coalho grelhado no pão brioche amarelo.", ing: ["Pão brioche amarelo c/ gergelim preto", "Carne 100g", "Queijo coalho grelhado", "Molho especial"] },
  ];
  const updP = db.prepare(`UPDATE products SET description = ?, ingredients = ?, updated_at = ? WHERE id = ?`);
  for (const pr of prods) {
    updP.run(pr.desc, JSON.stringify(pr.ing), Date.now(), pr.id);
  }
} catch {}

const MENU_REAL = [
  { id: "p1", oldName: "Sarro Burger", name: "Tô no Sarro Salada Burger", cat: "burgers", emoji: "🍔",
    desc: "100g de carne no pão brioche artesanal amarelo com gergelim preto, salada fresca e molho especial.",
    ingredients: ["Pão brioche amarelo c/ gergelim preto", "Carne 100g", "Alface", "Tomate", "Cebola roxa", "Molho especial"],
    price: 16, promo: null, badges: ["maisvendido"] },
  { id: "p2", oldName: "Bacon Sarro", name: "Sarro Massa Bacon Burger", cat: "burgers", emoji: "🥓",
    desc: "100g de carne, bacon crocante e creme cheddar no pão brioche.",
    ingredients: ["Pão brioche", "Carne 100g", "Bacon crocante", "Creme cheddar", "Molho especial"],
    price: 20, promo: null, badges: ["maisvendido"] },
  { id: "p3", oldName: "Duplo Sarro", name: "Sarro Peso Calabresa Burger", cat: "burgers", emoji: "🍔",
    desc: "100g de carne com calabresa e creme cheddar no pão brioche.",
    ingredients: ["Pão brioche", "Carne 100g", "Calabresa", "Creme cheddar", "Molho especial"],
    price: 25, promo: null, badges: [] },
  { id: "p4", oldName: "Smash do Sarro", name: "Sarro Desmantelo Cheddar Burger", cat: "burgers", emoji: "🍔",
    desc: "100g de carne com desmantelo de creme cheddar no pão brioche.",
    ingredients: ["Pão brioche", "Carne 100g", "Desmantelo de creme cheddar", "Molho especial"],
    price: 20, promo: null, badges: [] },
  { id: "p5", oldName: "Frango Empanado Sarro", name: "Sarro Arretado Burger", cat: "burgers", emoji: "🍔",
    desc: "100g de carne com queijo coalho grelhado no pão brioche. Arretado de bom!",
    ingredients: ["Pão brioche", "Carne 100g", "Queijo coalho grelhado", "Molho especial"],
    price: 23.9, promo: null, badges: ["novidade"] },
  { id: "p6", oldName: "Combo Sarro Completo", name: "Combo Dois Sarro Massa + 2 Refri", cat: "combos", emoji: "🍟",
    desc: "2x Sarro Massa Bacon + 2 refrigerantes lata. Pra dividir (ou não).",
    ingredients: ["2x Sarro Massa Bacon", "2 refrigerantes lata"],
    price: 49.99, promo: null, badges: ["maisvendido"] },
];
for (const m of MENU_REAL) {
  db.prepare(`UPDATE products SET name = ?, cat = ?, emoji = ?, description = ?,
    ingredients = ?, price = ?, promo = ?, badges = ?, updated_at = ? WHERE id = ? AND name = ?`)
    .run(m.name, m.cat, m.emoji, m.desc, JSON.stringify(m.ingredients), m.price, m.promo,
      JSON.stringify(m.badges), Date.now(), m.id, m.oldName);
}

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
if (getSettingRaw("tables_enabled") === undefined) {
  setSettingRaw("tables_enabled", "0");
}
if (getSettingRaw("tables_count") === undefined) {
  setSettingRaw("tables_count", "10");
}
if (getSettingRaw("pix_key") === undefined) {
  setSettingRaw("pix_key", "tonosarro@gmail.com");
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

  const insSet = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
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

// Gestão de usuários — nunca devolve o hash da senha
export function getUsers() {
  return db.prepare("SELECT id, name, username, role, driver_id, active, last_login_at FROM users ORDER BY name").all()
    .map((u) => ({ id: u.id, name: u.name, username: u.username, role: u.role, driverId: u.driver_id || null, active: u.active !== 0, lastLoginAt: u.last_login_at || null }));
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
    .map((p) => ({ id: p.id, name: p.name, rule: p.rule, active: !!p.active, window: p.window, startsAt: p.starts_at || null, endsAt: p.ends_at || null }));
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
    pixKey: s.pix_key || "",
    tablesEnabled: s.tables_enabled === "1",
    tablesCount: parseInt(s.tables_count || "10", 10),
  };
}

// Uso interno do servidor (inclui o segredo do webhook)
export function getPaymentSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    payHandle: s.pay_handle || "",
    appBaseUrl: s.app_base_url || "",
    pixKey: s.pix_key || "",
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

  const pixKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'pix_key'").get();
  const storeNameRow = db.prepare("SELECT value FROM settings WHERE key = 'store_name'").get();
  const pixKey = pixKeyRow?.value || "tonosarro@gmail.com";
  const storeName = storeNameRow?.value || "TO NO SARRO";

  return rows.map((o) => {
    const pay = pays.get(o.id);
    const isPix = o.payment === "PIX" || (typeof o.payment === "string" && o.payment.toUpperCase().includes("PIX"));
    const pixCode = isPix ? generatePixBRCode({
      key: pixKey,
      name: storeName,
      city: "PAULISTA",
      amount: o.total,
      txid: `PED${o.code}`,
    }) : null;
    return {
      id: o.id, code: o.code, channel: o.channel, status: o.status,
      createdAt: o.created_at, startedAt: o.started_at, driverId: o.driver_id,
      customer: { name: o.customer_name, phone: o.customer_phone, addr: o.customer_addr },
      payment: o.payment, type: o.type, note: o.note || "",
      subtotal: o.subtotal, fee: o.fee, discount: o.discount, total: o.total,
      paymentStatus: o.payment_status || "indefinido",
      payUrl: pay?.status === "pendente" ? pay.url : null,
      receiptUrl: pay?.receipt_url || null,
      paidAt: pay?.paid_at || null,
      pixCode,
      pixKey: isPix ? pixKey : null,
      routeId: o.route_id || null,
      routeSeq: o.route_seq || 1,
      settlementId: o.settlement_id || null,
      tableNumber: o.table_number || null,
      tableName: o.table_name || null,
      items: byOrder.get(o.id) || [],
    };
  });
}

// ============================================================
// FRENTE DE CAIXA / PDV — Turnos, Suprimentos, Sangrias e Fechamento
// ============================================================

export function getCashSummary(reg) {
  if (!reg) return null;

  const txs = db.prepare(`
    SELECT * FROM cash_transactions WHERE register_id = ? ORDER BY created_at DESC
  `).all(reg.id);

  let suprimentos = 0;
  let sangrias = 0;
  for (const t of txs) {
    if (t.type === "SUPRIMENTO") suprimentos += t.amount;
    if (t.type === "SANGRIA") sangrias += t.amount;
  }

  const endAt = reg.closed_at || Date.now();
  const orders = db.prepare(`
    SELECT total, payment, status FROM orders
    WHERE created_at >= ? AND created_at <= ? AND status != 'CANCELADO'
  `).all(reg.opened_at, endAt);

  let cashSales = 0;
  let pixSales = 0;
  let cardSales = 0;
  let otherSales = 0;
  let orderCount = orders.length;

  for (const o of orders) {
    const p = String(o.payment || "").toUpperCase();
    if (p.includes("DINHEIRO")) {
      cashSales += o.total;
    } else if (p.includes("PIX")) {
      pixSales += o.total;
    } else if (p.includes("CART") || p.includes("CREDITO") || p.includes("DEBITO")) {
      cardSales += o.total;
    } else {
      otherSales += o.total;
    }
  }

  const initialCash = Number(reg.initial_cash || 0);
  const totalSales = cashSales + pixSales + cardSales + otherSales;
  const expectedCash = initialCash + cashSales + suprimentos - sangrias;

  const closedCash = reg.closed_cash !== null ? Number(reg.closed_cash) : null;
  const declaredPix = reg.declared_pix !== null ? Number(reg.declared_pix) : null;
  const declaredCard = reg.declared_card !== null ? Number(reg.declared_card) : null;

  return {
    id: reg.id,
    status: reg.status,
    openedAt: reg.opened_at,
    closedAt: reg.closed_at,
    openedBy: reg.opened_by,
    closedBy: reg.closed_by,
    notes: reg.notes || "",
    summary: {
      initialCash: Math.round(initialCash * 100) / 100,
      suprimentos: Math.round(suprimentos * 100) / 100,
      sangrias: Math.round(sangrias * 100) / 100,
      cashSales: Math.round(cashSales * 100) / 100,
      pixSales: Math.round(pixSales * 100) / 100,
      cardSales: Math.round(cardSales * 100) / 100,
      otherSales: Math.round(otherSales * 100) / 100,
      totalSales: Math.round(totalSales * 100) / 100,
      orderCount,
      expectedCash: Math.round(expectedCash * 100) / 100,
      closedCash,
      declaredPix,
      declaredCard,
      diffCash: closedCash !== null ? Math.round((closedCash - expectedCash) * 100) / 100 : null,
      diffPix: declaredPix !== null ? Math.round((declaredPix - pixSales) * 100) / 100 : null,
      diffCard: declaredCard !== null ? Math.round((declaredCard - cardSales) * 100) / 100 : null,
    },
    transactions: txs.map((t) => ({
      id: t.id,
      registerId: t.register_id,
      type: t.type,
      method: t.method,
      amount: t.amount,
      reason: t.reason,
      createdAt: t.created_at,
      createdBy: t.created_by,
    })),
  };
}

export function getCurrentCashRegister() {
  const reg = db.prepare(`
    SELECT * FROM cash_registers WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1
  `).get();
  if (!reg) return null;
  return getCashSummary(reg);
}

export function openCashRegister({ openedBy, initialCash = 0, notes = "" }) {
  const existing = db.prepare(`SELECT id FROM cash_registers WHERE status = 'OPEN' LIMIT 1`).get();
  if (existing) {
    throw new Error("Já existe um turno de caixa aberto. Feche o anterior antes de abrir um novo.");
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const initAmount = Math.max(0, parseFloat(initialCash) || 0);

  db.prepare(`
    INSERT INTO cash_registers (id, opened_at, opened_by, initial_cash, status, notes)
    VALUES (?, ?, ?, ?, 'OPEN', ?)
  `).run(id, now, openedBy || "Operador", initAmount, notes || "");

  db.prepare(`
    INSERT INTO cash_transactions (id, register_id, type, method, amount, reason, created_at, created_by)
    VALUES (?, ?, 'ABERTURA', 'DINHEIRO', ?, 'Abertura de caixa / Fundo de troco inicial', ?, ?)
  `).run(crypto.randomUUID(), id, initAmount, now, openedBy || "Operador");

  const reg = db.prepare(`SELECT * FROM cash_registers WHERE id = ?`).get(id);
  return getCashSummary(reg);
}

export function addCashTransaction({ type, amount, reason, method = "DINHEIRO", createdBy, registerId }) {
  let targetId = registerId;
  if (!targetId) {
    const openReg = db.prepare(`SELECT id FROM cash_registers WHERE status = 'OPEN' LIMIT 1`).get();
    if (!openReg) throw new Error("Não há nenhum turno de caixa aberto no momento.");
    targetId = openReg.id;
  }

  const cleanAmount = Math.max(0, parseFloat(amount) || 0);
  if (cleanAmount <= 0) throw new Error("O valor da movimentação deve ser maior que zero.");

  const cleanType = String(type).toUpperCase();
  if (!["SUPRIMENTO", "SANGRIA"].includes(cleanType)) {
    throw new Error("Tipo de movimentação inválido (use SUPRIMENTO ou SANGRIA).");
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO cash_transactions (id, register_id, type, method, amount, reason, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, targetId, cleanType, method || "DINHEIRO", cleanAmount, reason || cleanType, now, createdBy || "Operador");

  const reg = db.prepare(`SELECT * FROM cash_registers WHERE id = ?`).get(targetId);
  return getCashSummary(reg);
}

export function closeCashRegister({ registerId, closedBy, closedCash, declaredPix, declaredCard, notes = "" }) {
  let reg;
  if (registerId) {
    reg = db.prepare(`SELECT * FROM cash_registers WHERE id = ?`).get(registerId);
  } else {
    reg = db.prepare(`SELECT * FROM cash_registers WHERE status = 'OPEN' LIMIT 1`).get();
  }

  if (!reg || reg.status !== "OPEN") {
    throw new Error("Não há nenhum turno de caixa aberto para ser fechado.");
  }

  const now = Date.now();
  const finalCash = parseFloat(closedCash) ?? 0;
  const finalPix = declaredPix !== undefined && declaredPix !== null && declaredPix !== "" ? parseFloat(declaredPix) : null;
  const finalCard = declaredCard !== undefined && declaredCard !== null && declaredCard !== "" ? parseFloat(declaredCard) : null;

  db.prepare(`
    UPDATE cash_registers
    SET status = 'CLOSED', closed_at = ?, closed_by = ?, closed_cash = ?, declared_pix = ?, declared_card = ?, notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(now, closedBy || "Operador", finalCash, finalPix, finalCard, notes || null, reg.id);

  db.prepare(`
    INSERT INTO cash_transactions (id, register_id, type, method, amount, reason, created_at, created_by)
    VALUES (?, ?, 'FECHAMENTO', 'DINHEIRO', ?, 'Fechamento de caixa com conferência', ?, ?)
  `).run(crypto.randomUUID(), reg.id, finalCash, now, closedBy || "Operador");

  const updated = db.prepare(`SELECT * FROM cash_registers WHERE id = ?`).get(reg.id);
  return getCashSummary(updated);
}

export function getCashHistory(limit = 20) {
  const rows = db.prepare(`
    SELECT * FROM cash_registers WHERE status = 'CLOSED' ORDER BY closed_at DESC LIMIT ?
  `).all(limit);
  return rows.map((r) => getCashSummary(r));
}

// ============================================================
// ENTREGAS — Agrupamento de Rotas Multi-Paradas & Acerto de Contas
// ============================================================

export function dispatchMultiStopRoute({ driverId, orderIds }) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error("Selecione pelo menos um pedido para a rota.");
  }
  const driver = db.prepare("SELECT * FROM drivers WHERE id = ?").get(driverId);
  if (!driver) throw new Error("Entregador não encontrado.");

  const routeId = crypto.randomUUID();
  const now = Date.now();

  const updateStmt = db.prepare(`
    UPDATE orders
    SET driver_id = ?, status = 'ROTA', started_at = ?, route_id = ?, route_seq = ?
    WHERE id = ?
  `);

  db.exec("BEGIN");
  try {
    orderIds.forEach((id, index) => {
      updateStmt.run(driverId, now, routeId, index + 1, id);
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { routeId, driver, orderIds, count: orderIds.length };
}

export function getDriverPendingSettlement(driverId) {
  const driver = db.prepare("SELECT * FROM drivers WHERE id = ?").get(driverId);
  if (!driver) throw new Error("Entregador não encontrado.");

  // Pedidos entregues por este motorista ainda não acertados
  const orders = getOrders().filter((o) =>
    o.driverId === driverId &&
    o.status === "ENTREGUE" &&
    (!o.settlementId || o.settlementId === "")
  );

  const deliveriesCount = orders.length;
  const totalFees = orders.reduce((sum, o) => sum + (o.fee || 0), 0);
  const totalCashCollected = orders
    .filter((o) => String(o.payment || "").toUpperCase().includes("DINHEIRO"))
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const basePay = 0;
  const totalDueToDriver = totalFees + basePay;
  const netBalance = Math.round((totalCashCollected - totalDueToDriver) * 100) / 100;

  return {
    driver: { id: driver.id, name: driver.name, phone: driver.phone, vehicle: driver.vehicle },
    orders,
    summary: {
      deliveriesCount,
      totalFees: Math.round(totalFees * 100) / 100,
      basePay,
      totalCashCollected: Math.round(totalCashCollected * 100) / 100,
      totalDueToDriver: Math.round(totalDueToDriver * 100) / 100,
      netBalance,
    },
  };
}

export function settleDriver({ driverId, settledBy = "Operador", basePay = 0, notes = "" }) {
  const pending = getDriverPendingSettlement(driverId);
  if (pending.orders.length === 0) {
    throw new Error("Não há entregas pendentes de acerto para este entregador.");
  }

  const bPay = Math.max(0, parseFloat(basePay) || 0);
  const totalDueToDriver = pending.summary.totalFees + bPay;
  const netBalance = Math.round((pending.summary.totalCashCollected - totalDueToDriver) * 100) / 100;

  const settlementId = crypto.randomUUID();
  const now = Date.now();

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO driver_settlements (id, driver_id, created_at, settled_by, deliveries_count, total_fees, base_pay, total_cash_collected, net_balance, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SETTLED', ?)
    `).run(
      settlementId,
      driverId,
      now,
      settledBy,
      pending.summary.deliveriesCount,
      pending.summary.totalFees,
      bPay,
      pending.summary.totalCashCollected,
      netBalance,
      notes || ""
    );

    const markOrder = db.prepare("UPDATE orders SET settlement_id = ? WHERE id = ?");
    for (const o of pending.orders) {
      markOrder.run(settlementId, o.id);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const settlement = db.prepare("SELECT * FROM driver_settlements WHERE id = ?").get(settlementId);
  return {
    ...settlement,
    driver: pending.driver,
    orders: pending.orders,
    summary: {
      deliveriesCount: settlement.deliveries_count,
      totalFees: settlement.total_fees,
      basePay: settlement.base_pay,
      totalDueToDriver: settlement.total_fees + settlement.base_pay,
      totalCashCollected: settlement.total_cash_collected,
      netBalance: settlement.net_balance,
    },
  };
}

export function getSettlementsHistory(limit = 30) {
  const rows = db.prepare(`
    SELECT s.*, d.name as driver_name, d.phone as driver_phone, d.vehicle as driver_vehicle
    FROM driver_settlements s
    JOIN drivers d ON d.id = s.driver_id
    ORDER BY s.created_at DESC
    LIMIT ?
  `).all(limit);

  return rows.map((r) => ({
    id: r.id,
    driverId: r.driver_id,
    createdAt: r.created_at,
    settledBy: r.settled_by,
    deliveriesCount: r.deliveries_count,
    totalFees: r.total_fees,
    basePay: r.base_pay,
    totalCashCollected: r.total_cash_collected,
    netBalance: r.net_balance,
    status: r.status,
    notes: r.notes || "",
    driver: {
      id: r.driver_id,
      name: r.driver_name,
      phone: r.driver_phone,
      vehicle: r.driver_vehicle,
    },
  }));
}
