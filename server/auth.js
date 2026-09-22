// ============================================================
// TÔ NO SARRO — Autenticação: bcrypt + sessão em cookie httpOnly
// Sem tokens no frontend; roles validadas em cada rota.
// Sprint4-6: rotação segura, detecção de reuso, IP/UA tracking
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
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(Date.now(), user.id);

  const token = crypto.randomBytes(32).toString("hex");
  const ua = String(req.headers["user-agent"] || "").slice(0, 200);
  try {
    db.prepare("INSERT INTO sessions (token, user_id, created_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)").run(token, user.id, Date.now(), ip, ua);
  } catch {
    // fallback para schema antigo sem ip/ua
    db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, user.id, Date.now());
  }
  // limpeza de sessões expiradas
  db.prepare("DELETE FROM sessions WHERE created_at < ?").run(Date.now() - SESSION_TTL);

  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
    secure: req.secure || (process.env.APP_BASE_URL || "").startsWith("https://") || process.env.SECURE_COOKIE === "1",
  });
  audit(user.username, "login", `ip ${ip} · ${ua.slice(0,50)}`);
  res.json({ user: publicUser(user) });
}

export function logout(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      db.prepare("DELETE FROM sessions WHERE token = ? OR previous_token = ?").run(token, token);
    } catch {
      db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    }
  }
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}

export function logoutAll(req, res) {
  if (!req.user) return res.status(401).json({ error: "Faça login para continuar." });
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.user.id);
  res.clearCookie(COOKIE, { path: "/" });
  audit(req.user.username, "logout_all", "todas sessões encerradas");
  res.json({ ok: true });
}

export function refreshSession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: "Sessão expirada." });
  
  // Verifica se token é um previous_token (reuso detectado - possível roubo)
  try {
    const reuse = db.prepare(`SELECT u.*, s.id as sid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.previous_token = ?`).get(token);
    if (reuse) {
      // Reuso detectado! Invalida todas sessões do usuário por segurança
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(reuse.id);
      audit(reuse.username, "session_reuse_detected", `possível roubo de sessão · ip ${req.ip}`);
      res.clearCookie(COOKIE, { path: "/" });
      return res.status(401).json({ error: "Sessão comprometida. Faça login novamente." });
    }
  } catch {}
  
  const row = db.prepare(`SELECT u.*, s.created_at, s.id as sid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  if (!row || row.active === 0) return res.status(401).json({ error: "Sessão inválida." });
  
  // Se sessão tem mais de 1 dia, rotaciona com detecção de reuso
  const age = Date.now() - row.created_at;
  if (age > 24*60*60*1000) {
    const newToken = crypto.randomBytes(32).toString("hex");
    try {
      db.prepare("UPDATE sessions SET token = ?, previous_token = ?, rotated_at = ?, created_at = ?, ip = ?, user_agent = ? WHERE id = ?")
        .run(newToken, token, Date.now(), Date.now(), req.ip || "?", String(req.headers["user-agent"]||"").slice(0,200), row.sid);
    } catch {
      // fallback schema antigo
      db.prepare("UPDATE sessions SET token = ?, created_at = ? WHERE token = ?").run(newToken, Date.now(), token);
    }
    res.cookie(COOKIE, newToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL,
      secure: req.secure || (process.env.APP_BASE_URL || "").startsWith("https://") || process.env.SECURE_COOKIE === "1",
    });
    audit(row.username, "session_refresh", `idade ${Math.round(age/3600000)}h · ip ${req.ip}`);
    return res.json({ user: publicUser(row), refreshed: true });
  }
  res.json({ user: publicUser(row), refreshed: false });
}

// Preenche req.user (ou null) a partir do cookie de sessão.
// Conta desativada perde o acesso na hora, mesmo com cookie válido.
// Também detecta reuso de previous_token (roubo de sessão)
export function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (token) {
    // Verifica reuso de token antigo (indica roubo)
    try {
      const reuse = db.prepare(`SELECT user_id FROM sessions WHERE previous_token = ?`).get(token);
      if (reuse) {
        // Token antigo sendo reusado após rotação - possível ataque
        // Invalida todas sessões do usuário
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(reuse.user_id);
        // Não preenche req.user, força logout
        return next();
      }
    } catch {}
    
    const row = db.prepare(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
    `).get(token);
    if (row && row.active !== 0) {
      // Verifica expiração
      const session = db.prepare("SELECT created_at FROM sessions WHERE token = ?").get(token);
      if (session && Date.now() - session.created_at > SESSION_TTL) {
        db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      } else {
        req.user = row;
      }
    }
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
