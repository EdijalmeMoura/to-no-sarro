// Logger estruturado com níveis, inspirado em Sentry/Bunyan
// Em produção, pode enviar para Sentry, Datadog, etc via SENTRY_DSN

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || "info";

function shouldLog(level) {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];
}

function formatLog(level, msg, meta = {}) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
    pid: process.pid,
  });
}

export const logger = {
  debug: (msg, meta) => {
    if (!shouldLog("debug")) return;
    console.log(formatLog("debug", msg, meta));
  },
  info: (msg, meta) => {
    if (!shouldLog("info")) return;
    console.log(formatLog("info", msg, meta));
  },
  warn: (msg, meta) => {
    if (!shouldLog("warn")) return;
    console.warn(formatLog("warn", msg, meta));
  },
  error: (msg, meta) => {
    console.error(formatLog("error", msg, meta));
    // Aqui enviaria para Sentry se configurado
    if (process.env.SENTRY_DSN) {
      // placeholder: em produção, import @sentry/node e captureException
      // Sentry.captureException(new Error(msg), { extra: meta });
    }
  },
};

// Middleware Express para log de requests
export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](`${method} ${url} ${res.statusCode}`, {
      method,
      url,
      status: res.statusCode,
      duration_ms: duration,
      ip,
      user: req.user?.username || "anon",
    });
  });
  next();
}

// Handler global de erros não tratados
export function setupErrorHandlers() {
  process.on("uncaughtException", (err) => {
    logger.error("uncaughtException", { error: err.message, stack: err.stack });
    // Em produção, não crashar imediatamente, mas logar
    // process.exit(1) // opcional
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandledRejection", { reason: String(reason) });
  });
}
