// ============================================================
// TÔ NO SARRO — Autenticação: bcrypt + sessão em cookie httpOnly
// Sem tokens no frontend; roles validadas em cada rota.
// ============================================================

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db, audit } from "./db.js";

export const ROLES = ["ADMIN", "GERENTE", "ATENDIMENTO", "COZINHA", "EXPEDICAO", "ENTREGADOR"];

const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 dias
const COOKIE = "sarro_session";

// Rate limit simples de login por IP (proteção força bruta)
const attempts = new Map(); // ip -> { count, resetAt }
const WINDOW = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() > a.resetAt) return false;
  return a.count >= MAX_ATTEMPTS;
}
function registerAttempt(ip, ok) {
  const a = attempts.get(ip);
  if (!a || Date.now() > a.resetAt) {
    attempts.set(ip, { count: ok ? 0 : 1, resetAt: Date.now() + WINDOW });
    return;
  }
  a.count = ok ? 0 : a.count + 1;
}

export function publicUser(u) {
  return u ? { id: u.id, name: u.name, username: u.username, role: u.role, driverId: u.driver_id || null, active: u.active !== 0 } : null;
}

export function login(req, res) {
  const ip = req.ip || "?";
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
  }
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return res.status(400).json({ error: "Informe usuário e senha." });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.pass_hash)) {
    registerAttempt(ip, false);
    audit(username, "login_falhou", `ip ${ip}`);
    return res.status(401).json({ error: "Usuário ou senha incorretos." });
  }
  if (user.active === 0) {
    registerAttempt(ip, false);
    audit(username, "login_bloqueado", "conta desativada");
    return res.status(403).json({ error: "Conta desativada. Fale com o administrador." });
  }
  registerAttempt(ip, true);

  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, user.id, Date.now());
  // limpeza de sessões expiradas
  db.prepare("DELETE FROM sessions WHERE created_at < ?").run(Date.now() - SESSION_TTL);

  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
    // https real (proxy/TLS) ou APP_BASE_URL https:// ou SECURE_COOKIE=1 → só viaja por TLS
    secure: req.secure || (process.env.APP_BASE_URL || "").startsWith("https://") || process.env.SECURE_COOKIE === "1",
  });
  audit(user.username, "login", `ip ${ip}`);
  res.json({ user: publicUser(user) });
}

export function logout(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}

// Preenche req.user (ou null) a partir do cookie de sessão.
// Conta desativada perde o acesso na hora, mesmo com cookie válido.
export function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (token) {
    const row = db.prepare(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
    `).get(token);
    if (row && row.active !== 0) req.user = row;
  }
  next();
}

// Exige autenticação e, opcionalmente, um dos papéis
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Faça login para continuar." });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Seu perfil não tem permissão para isto." });
    }
    next();
  };
}
