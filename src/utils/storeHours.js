// ============================================================
// Horário de funcionamento da semana (segunda a domingo)
// Regra do cardápio: a loja só aceita pedidos quando o dia está
// ativo E o horário atual está dentro da janela abertura→fechamento.
//
// O relógio é interpretado no fuso da loja (STORE_TZ), igual no
// servidor e no navegador, para o pedido não ser bloqueado por
// diferença de timezone entre cliente e API.
// ============================================================

export const STORE_TZ = "America/Sao_Paulo";

// Ordem de exibição (segunda → domingo) e chaves do agendamento
export const DAY_ORDER = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

export const DAY_LABELS = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta",
  sex: "Sexta", sab: "Sábado", dom: "Domingo",
};

export const DAY_SHORT = {
  seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui",
  sex: "Sex", sab: "Sáb", dom: "Dom",
};

export const DAY_BADGE = {
  seg: "seg", ter: "ter", qua: "qua", qui: "qui",
  sex: "sex", sab: "sáb", dom: "dom",
};

export const DEFAULT_DAY = { enabled: true, open: "18:00", close: "23:30" };

// Mapeia weekday curto do Intl (em inglês) → chave nossa
const WEEKDAY_TO_KEY = { Sun: "dom", Mon: "seg", Tue: "ter", Wed: "qua", Thu: "qui", Fri: "sex", Sat: "sab" };

// Relógio de parede da loja: { key: "qui", mins: 1110 }
function wallClock(date) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TZ,
    hourCycle: "h23",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    key: WEEKDAY_TO_KEY[get("weekday")] || "dom",
    mins: parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10),
  };
}

function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fmtTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// Preenche dias faltantes com o padrão (usado pelo formulário do admin)
export function normalizeWeekSchedule(raw) {
  const out = {};
  for (const d of DAY_ORDER) {
    const day = raw && typeof raw[d] === "object" && raw[d] ? raw[d] : null;
    out[d] = {
      enabled: day ? !!day.enabled : DEFAULT_DAY.enabled,
      open: day && toMin(day.open) !== null ? String(day.open) : DEFAULT_DAY.open,
      close: day && toMin(day.close) !== null ? String(day.close) : DEFAULT_DAY.close,
    };
  }
  return out;
}

// Sem agendamento salvo → comporta como antes (liberado)
export function isScheduleOpenNow(schedule, date = new Date()) {
  if (!schedule) return true;
  const { key, mins } = wallClock(date);

  // Janela do dia de hoje (inclui madrugada quando fecha após meia-noite)
  const today = schedule[key];
  if (today && today.enabled) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    if (o !== null && c !== null && o !== c) {
      if (o < c && mins >= o && mins < c) return true;
      if (o > c && mins >= o) return true; // noite deste dia (janela 18:00 → 02:00)
    }
  }

  // Virada de madrugada: janela de ontem (ex.: 18:00 → 02:00)
  const prevKey = DAY_ORDER[(DAY_ORDER.indexOf(key) + 6) % 7];
  const prev = schedule[prevKey];
  if (prev && prev.enabled) {
    const o = toMin(prev.open);
    const c = toMin(prev.close);
    if (o !== null && c !== null && o > c && mins < c) return true;
  }

  return false;
}

// Abertura efetiva: botão geral da loja E regra da semana
export function isOpenNow(settings, date = new Date()) {
  if (!settings || !settings.open) return false;
  return isScheduleOpenNow(settings.weekSchedule, date);
}

// Próxima abertura (para os textos "Fechado · …" / "Voltamos …")
// Retorna { rel: "hoje"|"amanha"|chaveDia, time: "18h", badge: "18h", suffix: "às 18h" } ou null
export function nextOpening(schedule, date = new Date()) {
  if (!schedule) return null;
  const { key, mins } = wallClock(date);

  for (let i = 0; i < 8; i++) {
    const k = DAY_ORDER[(DAY_ORDER.indexOf(key) + i) % 7];
    const day = schedule[k];
    if (!day || !day.enabled) continue;
    const o = toMin(day.open);
    if (o === null) continue;
    if (i === 0 && o <= mins) continue; // já passou da abertura de hoje
    const time = fmtTime(o);
    if (i === 0) return { rel: "hoje", time, badge: time, suffix: `às ${time}` };
    if (i === 1) return { rel: "amanha", time, badge: `amanhã ${time}`, suffix: `amanhã às ${time}` };
    return { rel: k, time, badge: `${DAY_BADGE[k]} ${time}`, suffix: `${DAY_LABELS[k].toLowerCase()} às ${time}` };
  }
  return null;
}

// Resumo em texto para o campo legado "hours" (ex.: "Seg–Dom · 18:00 – 23:30")
export function summarizeWeek(schedule) {
  if (!schedule) return "";
  const groups = [];
  for (const d of DAY_ORDER) {
    const day = schedule[d];
    const spec = day && day.enabled ? `${day.open} – ${day.close}` : null;
    const last = groups[groups.length - 1];
    if (last && last.spec === spec) last.days.push(d);
    else groups.push({ spec, days: [d] });
  }
  // Junta início/fim do ciclo quando são o mesmo trecho (ex.: Seg a Dom)
  if (groups.length > 1 && groups[0].spec && groups[0].spec === groups[groups.length - 1].spec) {
    const first = groups[0];
    const last = groups[groups.length - 1];
    groups[groups.length - 1] = { spec: first.spec, days: [...last.days, ...first.days] };
    groups.shift();
  }
  const label = (g) => {
    const a = DAY_SHORT[g.days[0]];
    const b = DAY_SHORT[g.days[g.days.length - 1]];
    return g.days.length > 1 ? `${a}–${b}` : a;
  };
  const text = groups.filter((g) => g.spec).map((g) => `${label(g)} · ${g.spec}`).join(" · ");
  return text || "Fechado todos os dias";
}
