// ============================================================
// TÔ NO SARRO — API REST + WebSocket (servidor único)
//
//   npm run dev:server   → http://localhost:3001
//   npm run dev:all      → API + Vite juntos
//   npm run build && npm start → produção (serving do dist/)
//
// Autenticação por sessão em cookie httpOnly; permissões por papel;
// preços e totais SEMPRE recalculados no servidor.
// ============================================================

import express from "express";
import cookieParser from "cookie-parser";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

import {
  db, audit, seedIfEmpty,
  getProducts, getOptionGroups, getBuilder, getCategories, getCoupons,
  getDrivers, getCustomers, getInventory, getPromos, getSettings,
  getSetting, setSetting, getOrders,
} from "./db.js";
import { attachUser, requireRole, login, logout, publicUser } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

seedIfEmpty();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());

// Headers de segurança básicos
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use(attachUser);

// ------------------------------------------------------------
// WebSocket — snapshot completo a cada mudança (simples e à prova
// de dessincronização; quando o volume crescer, trocamos por diffs)
// ------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

function snapshot() {
  return {
    orders: getOrders(),
    products: getProducts(),
    inventory: getInventory(),
    drivers: getDrivers(),
    customers: getCustomers(),
    settings: getSettings(),
    promos: getPromos(),
    coupons: getCoupons(),
  };
}

function broadcast() {
  const msg = JSON.stringify({ type: "sync", data: snapshot() });
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(msg);
  }
}

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------
app.post("/api/auth/login", login);
app.post("/api/auth/logout", logout);
app.get("/api/auth/me", (req, res) => res.json({ user: publicUser(req.user) }));

// ------------------------------------------------------------
// BOOTSTRAP — tudo que o app precisa em uma chamada
// ------------------------------------------------------------
app.get("/api/bootstrap", (_req, res) => {
  res.json({
    ...snapshot(),
    categories: getCategories(),
    optionGroups: getOptionGroups(),
    builder: getBuilder(),
    me: publicUser(_req.user),
  });
});

// ------------------------------------------------------------
// CUPONS
// ------------------------------------------------------------
app.post("/api/coupons/validate", (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const subtotal = Number(req.body?.subtotal) || 0;
  const c = db.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").get(code);
  if (!c) return res.status(404).json({ error: "Cupom não encontrado ou expirado." });
  if (subtotal < c.min) {
    return res.status(400).json({ error: `Esse cupom vale a partir de R$ ${c.min.toFixed(2).replace(".", ",")}.` });
  }
  res.json({ coupon: { code: c.code, type: c.type, value: c.value, min: c.min, note: c.note } });
});

// ------------------------------------------------------------
// PEDIDOS
// ------------------------------------------------------------

// Tabela de preços “verdade”: produtos + opções + builder
function priceTable() {
  const t = new Map();
  for (const o of db.prepare("SELECT o.id, o.name, o.price, o.group_id FROM options o").all()) {
    t.set(o.id, { ...o, builder: false });
  }
  for (const o of db.prepare("SELECT id, name, price, group_id FROM builder_options").all()) {
    t.set(o.id, { ...o, builder: true });
  }
  return t;
}

const BUILDER_GROUPS = new Set(["pao", "carne", "queijoB", "molhoB"]);

function shapeOrder(o) {
  return o; // getOrders() já devolve o formato do frontend
}

app.post("/api/orders", (req, res) => {
  const body = req.body || {};
  const settings = getSettings();
  const isStaffChannel = ["IFOOD", "NNFOOD", "WHATSAPP"].includes(body.channel);
  if (isStaffChannel && !req.user) {
    return res.status(401).json({ error: "Canais externos exigem autenticação." });
  }

  if (!isStaffChannel && !settings.open) {
    return res.status(409).json({ error: "A loja está fechada agora. Voltamos às 18h!" });
  }

  const { customer = {}, items = [], type = "delivery", payment = "PIX", couponCode, note = "" } = body;
  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const addr = String(customer.addr || "").trim();

  if (name.length < 3) return res.status(400).json({ error: "Informe seu nome completo." });
  if (phone.replace(/\D/g, "").length < 10) return res.status(400).json({ error: "WhatsApp inválido." });
  if (!["delivery", "pickup"].includes(type)) return res.status(400).json({ error: "Tipo de pedido inválido." });
  if (type === "delivery" && addr.length < 8) return res.status(400).json({ error: "Informe o endereço de entrega." });
  if (!["PIX", "Cartão", "Dinheiro"].includes(payment.split(" ")[0])) {
    return res.status(400).json({ error: "Forma de pagamento inválida." });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 60) {
    return res.status(400).json({ error: "Carrinho vazio ou inválido." });
  }
  if (typeof note !== "string" || note.length > 200) return res.status(400).json({ error: "Observação muito longa." });

  const prices = priceTable();
  const products = new Map(getProducts().map((p) => [p.id, p]));
  let subtotal = 0;
  const cleanItems = [];

  for (const it of items) {
    const p = products.get(String(it.productId));
    if (!p || !p.available) return res.status(400).json({ error: `Produto indisponível: ${it.productId}` });
    const qty = Math.floor(Number(it.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) return res.status(400).json({ error: `Quantidade inválida em ${p.name}.` });
    if (typeof (it.note ?? "") !== "string" || (it.note ?? "").length > 140) {
      return res.status(400).json({ error: `Observação muito longa em ${p.name}.` });
    }

    const optIds = Array.isArray(it.optionIds) ? it.optionIds.slice(0, 12).map(String) : [];
    const opts = [];
    let extra = 0;

    if (p.builder) {
      const byGroup = new Map();
      for (const oid of optIds) {
        const o = prices.get(oid);
        if (!o || !o.builder) return res.status(400).json({ error: `Opção inválida (${oid}) em ${p.name}.` });
        byGroup.set(o.group_id, o);
      }
      for (const gid of BUILDER_GROUPS) {
        const o = byGroup.get(gid);
        if (!o) return res.status(400).json({ error: `Escolha incompleta em ${p.name}.` });
        extra += o.price;
        opts.push({ id: o.id, name: o.name, price: o.price });
      }
    } else {
      const allowed = new Set(p.groups);
      for (const oid of optIds) {
        const o = prices.get(oid);
        if (!o || o.builder || !allowed.has(o.group_id)) {
          return res.status(400).json({ error: `Adicional inválido (${oid}) em ${p.name}.` });
        }
        extra += o.price;
        opts.push({ id: o.id, name: o.name, price: o.price });
      }
    }

    const unit = Math.max(0, (p.promo ?? p.price) + extra);
    subtotal += unit * qty;
    cleanItems.push({
      id: crypto.randomUUID(), productId: p.id, name: p.name, emoji: p.emoji,
      qty, unit: Math.round(unit * 100) / 100, opts, note: it.note || "",
    });
  }

  // Pedido mínimo (só delivery)
  if (type === "delivery" && subtotal < settings.minOrder) {
    return res.status(400).json({ error: `Pedido mínimo de R$ ${settings.minOrder.toFixed(2).replace(".", ",")} para entrega.` });
  }

  // Cupom
  let discount = 0;
  let fee = type === "pickup" ? 0 : settings.fee;
  let coupon = null;
  if (couponCode) {
    const c = db.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").get(String(couponCode).toUpperCase());
    if (!c || subtotal < c.min) return res.status(400).json({ error: "Cupom inválido para este pedido." });
    coupon = c;
    if (c.type === "percent") discount = subtotal * (c.value / 100);
    if (c.type === "fixed") discount = c.value;
    if (c.type === "freeship") fee = 0;
    discount = Math.min(discount, subtotal);
  }

  const total = Math.max(0, subtotal + fee - discount);
  const code = (parseInt(getSetting("seq") || "1047", 10) || 1047) + 1;
  setSetting("seq", code);

  const id = crypto.randomUUID();
  const now = Date.now();
  const channel = isStaffChannel ? body.channel : "DIRECT";
  const paymentLabel = payment + (/^Dinheiro/.test(payment) && body.changeFor ? ` (troco p/ ${String(body.changeFor).slice(0, 20)})` : "");

  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO orders (id, code, channel, status, created_at, customer_name, customer_phone, customer_addr, payment, type, note, subtotal, fee, discount, total)
      VALUES (?, ?, ?, 'NOVO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, channel, now, name, phone, type === "pickup" ? "Retirada na loja" : addr,
      paymentLabel, type, note, subtotal, fee, discount, total);

    const insItem = db.prepare("INSERT INTO order_items (id, order_id, product_id, name, emoji, qty, unit, opts, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const it of cleanItems) {
      insItem.run(it.id, id, it.productId, it.name, it.emoji, it.qty, it.unit, JSON.stringify(it.opts), it.note);
    }
    if (coupon) db.prepare("UPDATE coupons SET uses = uses + 1 WHERE code = ?").run(coupon.code);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    console.error("[orders] falha ao gravar:", e);
    return res.status(500).json({ error: "Não conseguimos registrar o pedido. Tente novamente." });
  }

  // CRM: atualiza ou cria cliente + pontos de fidelidade
  const digits = phone.replace(/\D/g, "");
  const existing = db.prepare("SELECT * FROM customers WHERE REPLACE(REPLACE(phone,'(',''),')','') LIKE ?").get(`%${digits.slice(-8)}%`);
  const gained = Math.floor(total / 10);
  if (existing) {
    const spent = existing.spent + total;
    const tier = spent >= 500 ? "VIP" : existing.orders + 1 >= 2 ? "Recorrente" : "Novo";
    db.prepare("UPDATE customers SET orders = orders + 1, spent = ?, last = 'Hoje', tier = ?, points = points + ? WHERE id = ?")
      .run(spent, tier, gained, existing.id);
  } else {
    db.prepare("INSERT INTO customers (id, name, phone, orders, spent, last, tier, addr, points) VALUES (?, ?, ?, 1, ?, 'Hoje', 'Novo', ?, ?)")
      .run(crypto.randomUUID(), name, phone, total, addr, gained);
  }

  audit(req.user?.username || name, "pedido_criado", `#${code} · ${channel} · R$ ${total.toFixed(2)}`);
  broadcast();

  const created = getOrders().find((o) => o.id === id);
  res.status(201).json({ order: shapeOrder(created) });
});

// Simulação de pedido externo (iFood/99Food/WhatsApp) — staff
app.post("/api/orders/external", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "EXPEDICAO"), (req, res) => {
  const channel = ["IFOOD", "NNFOOD", "WHATSAPP"].includes(req.body?.channel) ? req.body.channel : "IFOOD";
  const pool = getProducts().filter((p) => p.available && !p.builder);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const names = ["Tiago Ramos", "Juliana Melo", "Diego Alves", "Camila Rocha"];
  const name = names[Math.floor(Math.random() * names.length)];
  const code = (parseInt(getSetting("seq") || "1047", 10) || 1047) + 1;
  setSetting("seq", code);

  const unit = pick.promo ?? pick.price;
  const id = crypto.randomUUID();
  const fee = 7.9;
  db.prepare(`
    INSERT INTO orders (id, code, channel, status, created_at, customer_name, customer_phone, customer_addr, payment, type, subtotal, fee, discount, total)
    VALUES (?, ?, ?, 'NOVO', ?, ?, ?, ?, ?, 'delivery', ?, ?, 0, ?)
  `).run(id, code, channel, Date.now(), name,
    "(81) 9" + Math.floor(10000000 + Math.random() * 89999999),
    "Rua Projetada, 100 — Janga, Paulista/PE",
    channel === "IFOOD" ? "Cartão (iFood)" : channel === "NNFOOD" ? "Cartão (99Food)" : "PIX",
    unit, fee, unit + fee);
  db.prepare("INSERT INTO order_items (id, order_id, product_id, name, emoji, qty, unit, opts, note) VALUES (?, ?, ?, ?, ?, 1, ?, '[]', '')")
    .run(crypto.randomUUID(), id, pick.id, pick.name, pick.emoji, unit);

  audit(req.user.username, "pedido_externo", `#${code} · ${channel}`);
  broadcast();
  res.status(201).json({ order: getOrders().find((o) => o.id === id) });
});

const VALID_STATUS = new Set(["NOVO", "CONFIRMADO", "PREPARO", "PRONTO", "EMBALADO", "AGUARDANDO", "ROTA", "ENTREGUE", "CANCELADO"]);

app.patch("/api/orders/:id/status", requireRole("ADMIN", "GERENTE", "ATENDIMENTO", "COZINHA", "EXPEDICAO", "ENTREGADOR"), (req, res) => {
  const { status } = req.body || {};
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (!VALID_STATUS.has(status)) return res.status(400).json({ error: "Status inválido." });

  const role = req.user.role;
  if (role === "COZINHA" && !["PREPARO", "PRONTO", "CANCELADO"].includes(status)) {
    return res.status(403).json({ error: "A cozinha só pode iniciar preparo, marcar pronto ou cancelar." });
  }
  if (role === "ENTREGADOR") {
    if (!["ROTA", "ENTREGUE"].includes(status)) {
      return res.status(403).json({ error: "Entregador só pode sair para entrega e concluir." });
    }
    if (o.driver_id !== req.user.driver_id) {
      return res.status(403).json({ error: "Esta entrega não é sua." });
    }
  }

  const startedAt = o.started_at ?? (status !== "NOVO" ? Date.now() : null);
  db.prepare("UPDATE orders SET status = ?, started_at = ? WHERE id = ?").run(status, startedAt, o.id);

  // contador do entregador
  if (status === "ENTREGUE" && o.driver_id) {
    db.prepare("UPDATE drivers SET status = 'livre', deliveries = deliveries + 1 WHERE id = ?").run(o.driver_id);
  }
  if (status === "ROTA" && o.driver_id) {
    db.prepare("UPDATE drivers SET status = 'em rota' WHERE id = ?").run(o.driver_id);
  }

  audit(req.user.username, "pedido_status", `#${o.code} → ${status}`);
  broadcast();
  res.json({ order: getOrders().find((x) => x.id === o.id) });
});

app.patch("/api/orders/:id/driver", requireRole("ADMIN", "GERENTE", "EXPEDICAO"), (req, res) => {
  const { driverId } = req.body || {};
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  const d = db.prepare("SELECT * FROM drivers WHERE id = ?").get(String(driverId || ""));
  if (!d) return res.status(400).json({ error: "Entregador inválido." });

  db.prepare("UPDATE orders SET driver_id = ?, status = CASE WHEN status = 'AGUARDANDO' THEN 'ROTA' ELSE status END, started_at = COALESCE(started_at, ?) WHERE id = ?")
    .run(d.id, Date.now(), o.id);
  db.prepare("UPDATE drivers SET status = 'em rota' WHERE id = ?").run(d.id);

  audit(req.user.username, "pedido_entregador", `#${o.code} → ${d.name}`);
  broadcast();
  res.json({ order: getOrders().find((x) => x.id === o.id) });
});

// ------------------------------------------------------------
// PRODUTOS / ESTOQUE / CONFIG (admin)
// ------------------------------------------------------------

const BADGES_OK = new Set(["maisvendido", "novidade", "promocao"]);

// Valida e normaliza o payload de produto; devolve { patch } ou { error }
function productPatch(body, { partial = true } = {}) {
  const b = body || {};
  const patch = {};
  const req = (cond, msg) => { if (!cond) throw new Error(msg); };

  try {
    if (b.name !== undefined || !partial) {
      const v = String(b.name ?? "").trim();
      req(v.length >= 3 && v.length <= 80, "Nome deve ter entre 3 e 80 caracteres.");
      patch.name = v;
    }
    if (b.cat !== undefined || !partial) {
      const v = String(b.cat ?? "");
      req(db.prepare("SELECT 1 FROM categories WHERE id = ?").get(v), "Categoria inválida.");
      patch.cat = v;
    }
    if (b.price !== undefined || !partial) {
      const v = Number(b.price);
      req(Number.isFinite(v) && v >= 0 && v <= 999, "Preço inválido.");
      patch.price = Math.round(v * 100) / 100;
    }
    if (b.promo !== undefined) {
      if (b.promo === null || b.promo === "") patch.promo = null;
      else {
        const v = Number(b.promo);
        req(Number.isFinite(v) && v >= 0 && v <= 999, "Preço promocional inválido.");
        patch.promo = Math.round(v * 100) / 100;
      }
    }
    if (patch.price !== undefined && patch.promo != null && patch.promo >= patch.price) {
      return { error: "O preço promocional precisa ser menor que o preço normal." };
    }
    if (b.description !== undefined) {
      patch.description = String(b.description ?? "").trim().slice(0, 300);
    }
    if (b.ingredients !== undefined) {
      req(Array.isArray(b.ingredients), "Ingredientes inválidos.");
      const list = b.ingredients.map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 15);
      patch.ingredients = JSON.stringify(list);
    }
    if (b.emoji !== undefined) patch.emoji = String(b.emoji ?? "🍔").slice(0, 8) || "🍔";
    if (b.time !== undefined) {
      const v = Math.floor(Number(b.time));
      req(Number.isFinite(v) && v >= 1 && v <= 180, "Tempo de preparo inválido.");
      patch.time = v;
    }
    if (b.badges !== undefined) {
      req(Array.isArray(b.badges) && b.badges.every((x) => BADGES_OK.has(x)), "Selo inválido.");
      patch.badges = JSON.stringify(b.badges);
    }
    if (b.groups !== undefined) {
      req(Array.isArray(b.groups), "Grupos de opcionais inválidos.");
      const known = new Set(db.prepare("SELECT id FROM option_groups").all().map((g) => g.id));
      req(b.groups.every((g) => known.has(g)), "Grupo de opcionais desconhecido.");
      patch.groups = JSON.stringify(b.groups);
    }
    if (b.available !== undefined) patch.available = b.available ? 1 : 0;
    if (b.builder !== undefined) patch.builder = b.builder ? 1 : 0;
    if (b.stock !== undefined) {
      const v = Math.floor(Number(b.stock));
      req(Number.isFinite(v) && v >= 0 && v <= 9999, "Estoque inválido.");
      patch.stock = v;
    }
  } catch (e) {
    return { error: e.message };
  }
  return { patch };
}

const touchProduct = (id) => db.prepare("UPDATE products SET updated_at = ? WHERE id = ?").run(Date.now(), id);

app.post("/api/products", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const { patch, error } = productPatch(req.body, { partial: false });
  if (error) return res.status(400).json({ error });
  const id = "p" + crypto.randomBytes(4).toString("hex");
  db.prepare(`
    INSERT INTO products (id, name, cat, emoji, description, ingredients, price, promo, time, badges, available, groups, stock, builder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patch.name, patch.cat, patch.emoji || "🍔", patch.description || "",
    patch.ingredients || "[]", patch.price, patch.promo ?? null, patch.time ?? 15,
    patch.badges || "[]", patch.available ?? 1, patch.groups || "[]", patch.stock ?? 0, patch.builder ?? 0);

  audit(req.user.username, "produto_criado", `${patch.name} (${id})`);
  broadcast();
  res.status(201).json({ product: getProducts().find((p) => p.id === id) });
});

app.patch("/api/products/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Produto não encontrado." });
  const { patch, error } = productPatch(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const keys = Object.keys(patch);
  if (!keys.length) return res.status(400).json({ error: "Nada para atualizar." });

  const price = patch.price ?? p.price;
  const promo = patch.promo !== undefined ? patch.promo : p.promo;
  if (promo != null && promo >= price) {
    return res.status(400).json({ error: "O preço promocional precisa ser menor que o preço normal." });
  }

  const set = keys.map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE products SET ${set} WHERE id = ?`).run(...keys.map((k) => patch[k]), p.id);
  touchProduct(p.id);

  audit(req.user.username, "produto_atualizado", `${p.name}: ${JSON.stringify(patch).slice(0, 200)}`);
  broadcast();
  res.json({ ok: true });
});

app.delete("/api/products/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Produto não encontrado." });
  const used = db.prepare("SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?").get(p.id).n;
  if (used > 0) {
    return res.status(409).json({
      error: `“${p.name}” consta em ${used} pedido(s) do histórico. Despublique o produto em vez de excluir.`,
    });
  }
  db.prepare("DELETE FROM products WHERE id = ?").run(p.id);
  for (const ext of ["jpg", "png", "webp"]) {
    const f = path.join(__dirname, "..", "public", "img", "products", `${p.id}.${ext}`);
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  audit(req.user.username, "produto_excluido", p.name);
  broadcast();
  res.json({ ok: true });
});

// Upload de foto do produto (binário cru; sem dependências de multipart)
const UPLOAD_DIR = path.join(__dirname, "data", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/img-up", express.static(UPLOAD_DIR, { maxAge: "1h" }));

app.post("/api/products/:id/image", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Produto não encontrado." });

  const ctype = req.headers["content-type"] || "";
  const ext = ctype.includes("png") ? "png" : ctype.includes("webp") ? "webp" : ctype.includes("jpeg") ? "jpg" : null;
  if (!ext) return res.status(400).json({ error: "Envie a imagem em JPG, PNG ou WebP." });

  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on("data", (c) => {
    size += c.length;
    if (size > 3 * 1024 * 1024) {
      aborted = true;
      res.status(413).json({ error: "Imagem acima de 3MB." });
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => {
    if (aborted) return;
    const name = `${p.id}-${Date.now().toString(36)}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.concat(chunks));
    // remove uploads antigos deste produto
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      if (f.startsWith(`${p.id}-`) && f !== name) fs.rmSync(path.join(UPLOAD_DIR, f));
    }
    db.prepare("UPDATE products SET img = ?, updated_at = ? WHERE id = ?").run(name, Date.now(), p.id);
    audit(req.user.username, "produto_foto", `${p.name} → ${name}`);
    broadcast();
    res.json({ ok: true, img: name });
  });
  req.on("error", () => { if (!aborted) res.status(500).json({ error: "Falha no upload." }); });
});

app.patch("/api/inventory/:id", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const i = db.prepare("SELECT * FROM inventory WHERE id = ?").get(req.params.id);
  if (!i) return res.status(404).json({ error: "Item não encontrado." });
  const delta = Number(req.body?.delta);
  if (!Number.isFinite(delta)) return res.status(400).json({ error: "Movimento inválido." });
  const qty = Math.max(0, Math.round((i.qty + delta) * 10) / 10);
  db.prepare("UPDATE inventory SET qty = ? WHERE id = ?").run(qty, i.id);
  audit(req.user.username, "estoque_movimento", `${i.name} ${delta > 0 ? "+" : ""}${delta} → ${qty}`);
  broadcast();
  res.json({ ok: true });
});

app.patch("/api/settings", requireRole("ADMIN", "GERENTE"), (req, res) => {
  const b = req.body || {};
  if (typeof b.open === "boolean") setSetting("open", b.open ? "1" : "0");
  audit(req.user.username, "config", JSON.stringify(b).slice(0, 200));
  broadcast();
  res.json({ ok: true });
});

app.get("/api/audit", requireRole("ADMIN"), (_req, res) => {
  res.json({ logs: db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").all() });
});

// 404 da API
app.use("/api", (_req, res) => res.status(404).json({ error: "Rota não encontrada." }));

// Erros (incl. JSON malformado)
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
  console.error("[api]", err);
  res.status(500).json({ error: "Erro interno." });
});

// ------------------------------------------------------------
// Estático — em produção servimos o build do Vite
// ------------------------------------------------------------
const DIST = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api|\/ws).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}

server.listen(PORT, () => {
  console.log(`[api] TÔ NO SARRO backend em http://localhost:${PORT}`);
  console.log(`[api] WebSocket em ws://localhost:${PORT}/ws`);
});
