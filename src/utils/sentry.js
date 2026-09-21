// Frontend observabilidade - placeholder para Sentry
// Para ativar, defina VITE_SENTRY_DSN no .env e instale @sentry/react

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.log("[sentry] DSN não configurado, usando logger local");
    return;
  }
  // Carregamento opcional - não quebra build se não instalado
  // Usa eval para evitar resolução estática do Rollup
  const moduleName = "@sentry/react";
  import(/* @vite-ignore */ moduleName).then(Sentry => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
    console.log("[sentry] Frontend inicializado");
  }).catch(() => {
    console.warn("[sentry] @sentry/react não instalado, pule");
  });
}

export function captureError(error, context = {}) {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    const moduleName = "@sentry/react";
    import(/* @vite-ignore */ moduleName).then(Sentry => {
      Sentry.captureException(error, { extra: context });
    }).catch(() => {});
  }
  console.error("[error]", error, context);
}

export function captureMessage(msg, level = "info", context = {}) {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    const moduleName = "@sentry/react";
    import(/* @vite-ignore */ moduleName).then(Sentry => {
      Sentry.captureMessage(msg, { level, extra: context });
    }).catch(() => {});
  }
  console.log(`[${level}]`, msg, context);
}
