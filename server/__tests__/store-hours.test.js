import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  isScheduleOpenNow, isOpenNow, nextOpening, normalizeWeekSchedule, summarizeWeek, DAY_ORDER,
} from "../utils/storeHours.js";
import { validateSettings, weekScheduleSchema } from "../schemas/settings.js";

// Datas fixas em -03:00 (fuso de São Paulo, sem DST no Brasil)
// 2026-09-24 = quinta-feira
const thu = (t) => new Date(`2026-09-24T${t}-03:00`);
const fri = (t) => new Date(`2026-09-25T${t}-03:00`);
const sat = (t) => new Date(`2026-09-26T${t}-03:00`);

const base = () =>
  normalizeWeekSchedule({
    seg: { enabled: false, open: "18:00", close: "23:30" },
    ter: { enabled: true, open: "18:00", close: "23:30" },
    qua: { enabled: true, open: "18:00", close: "23:30" },
    qui: { enabled: true, open: "18:00", close: "23:30" },
    sex: { enabled: true, open: "18:00", close: "23:30" },
    sab: { enabled: true, open: "18:00", close: "23:30" },
    dom: { enabled: true, open: "18:00", close: "23:30" },
  });

describe("storeHours — regra da semana", () => {
  it("sem agendamento salvo, libera (comportamento antigo)", () => {
    expect(isScheduleOpenNow(null, thu("20:00"))).toBe(true);
  });

  it("dia ativo dentro da janela → aberto", () => {
    expect(isScheduleOpenNow(base(), thu("18:30"))).toBe(true);
    expect(isScheduleOpenNow(base(), thu("23:29"))).toBe(true);
  });

  it("fora da janela → fechado", () => {
    expect(isScheduleOpenNow(base(), thu("17:59"))).toBe(false);
    expect(isScheduleOpenNow(base(), thu("23:30"))).toBe(false);
    expect(isScheduleOpenNow(base(), thu("03:00"))).toBe(false);
  });

  it("dia desativado → fechado mesmo dentro do horário", () => {
    const s = base();
    s.qui.enabled = false;
    expect(isScheduleOpenNow(s, thu("19:00"))).toBe(false);
  });

  it("janela que vira a madrugada (sex 18:00 → 02:00)", () => {
    const s = base();
    s.sex = { enabled: true, open: "18:00", close: "02:00" };
    expect(isScheduleOpenNow(s, fri("23:00"))).toBe(true); // noite de sexta
    expect(isScheduleOpenNow(s, sat("01:00"))).toBe(true); // madrugada de sábado (janela de ontem)
    expect(isScheduleOpenNow(s, sat("03:00"))).toBe(false); // depois de fechar
    expect(isScheduleOpenNow(s, fri("17:00"))).toBe(false); // antes de abrir
  });

  it("isOpenNow exige o botão geral da loja ligado", () => {
    expect(isOpenNow({ open: true, weekSchedule: base() }, thu("19:00"))).toBe(true);
    expect(isOpenNow({ open: false, weekSchedule: base() }, thu("19:00"))).toBe(false);
    expect(isOpenNow({ open: true, weekSchedule: null }, thu("19:00"))).toBe(true);
  });
});

describe("storeHours — próxima abertura", () => {
  it("antes de abrir hoje → hoje", () => {
    const n = nextOpening(base(), thu("10:00"));
    expect(n).toMatchObject({ rel: "hoje", time: "18h" });
    expect(n.suffix).toBe("às 18h");
  });

  it("depois de fechar → amanhã (sexta ativa)", () => {
    const n = nextOpening(base(), thu("23:45"));
    expect(n).toMatchObject({ rel: "amanha", time: "18h" });
    expect(n.suffix).toBe("amanhã às 18h");
  });

  it("pula dias desativados até o próximo ativo", () => {
    const s = base();
    s.sex.enabled = false;
    s.sab.enabled = false;
    const n = nextOpening(s, thu("23:45"));
    expect(n.rel).toBe("dom"); // dom é o próximo ativo
    expect(n.badge).toContain("dom");
  });

  it("dia totalmente desabilitado → null", () => {
    const s = normalizeWeekSchedule(
      Object.fromEntries(DAY_ORDER.map((d) => [d, { enabled: false, open: "18:00", close: "23:30" }]))
    );
    expect(nextOpening(s, thu("10:00"))).toBeNull();
  });
});

describe("storeHours — formulário e resumo", () => {
  it("normalizeWeekSchedule preenche dias faltantes com o padrão", () => {
    const s = normalizeWeekSchedule({});
    expect(DAY_ORDER.every((d) => s[d].enabled)).toBe(true);
    expect(s.seg.open).toBe("18:00");
    expect(s.dom.close).toBe("23:30");
  });

  it("summarizeWeek agrupa dias iguais", () => {
    expect(summarizeWeek(base())).toBe("Ter–Dom · 18:00 – 23:30");
    const all = normalizeWeekSchedule({});
    expect(summarizeWeek(all)).toBe("Seg–Dom · 18:00 – 23:30");
  });
});

describe("settings — validação do week_schedule", () => {
  const valid = () =>
    Object.fromEntries(DAY_ORDER.map((d) => [d, { enabled: true, open: "18:00", close: "23:30" }]));

  it("aceita agendamento completo", () => {
    expect(() => weekScheduleSchema.parse(valid())).not.toThrow();
    expect(() => validateSettings({ week_schedule: valid() })).not.toThrow();
  });

  it("rejeita horário inválido", () => {
    const bad = valid();
    bad.seg.open = "25:99";
    expect(() => weekScheduleSchema.parse(bad)).toThrow();
    expect(() => validateSettings({ week_schedule: bad })).toThrow();
  });

  it("rejeita dia com formato errado e dia faltando", () => {
    const bad = valid();
    bad.ter.open = "8pm";
    expect(() => weekScheduleSchema.parse(bad)).toThrow();
    const missing = valid();
    delete missing.dom;
    expect(() => weekScheduleSchema.parse(missing)).toThrow();
  });

  it("rejeita enabled não booleano", () => {
    const bad = valid();
    bad.seg.enabled = "sim";
    expect(() => weekScheduleSchema.parse(bad)).toThrow();
  });
});

describe("storeHours — cópias sincronizadas", () => {
  it("server/utils/storeHours.js é idêntico a src/utils/storeHours.js", () => {
    const clientSrc = readFileSync(new URL("../../src/utils/storeHours.js", import.meta.url), "utf8");
    const serverSrc = readFileSync(new URL("../utils/storeHours.js", import.meta.url), "utf8");
    expect(serverSrc).toBe(clientSrc);
  });
});
