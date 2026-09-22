// ============================================================
// Avisos sonoros dos painéis (KDS, expedição e área do entregador)
//
// Antes estas funções viviam no App.jsx monolítico; quando os painéis
// foram modularizados, cada arquivo copiou o chamador mas a
// getAudioContext() ficou só no App.jsx — o ReferenceError era engolido
// pelo try/catch e o sino nunca tocava. Agora é um módulo compartilhado.
// ============================================================

let audioCtx = null;

export function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tones(notes, type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const t of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(t.freq, now + t.start);

      gain.gain.setValueAtTime(0.001, now + t.start);
      gain.gain.exponentialRampToValueAtTime(t.peak || 0.35, now + t.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t.start);
      osc.stop(now + t.start + t.dur + 0.05);
    }
  } catch (e) {
    /* som é opcional — nunca derruba o painel */
  }
}

/** Dois toques agudos: pedido novo na tela. */
export function playKitchenChime() {
  tones([
    { freq: 880, start: 0, dur: 0.15 },
    { freq: 1174, start: 0.18, dur: 0.35 },
  ], "sine");
}

/** Duas notas descendentes: tarefa concluída / entrega liberada. */
export function playReadyChime() {
  tones([
    { freq: 987.77, start: 0, dur: 0.3, peak: 0.4 },
    { freq: 659.25, start: 0.28, dur: 0.5, peak: 0.4 },
  ], "triangle");
}

/** Alarme repetido para entrega atribuída e ainda não aceita. */
export function playRouteAlert(times = 3) {
  tones(
    Array.from({ length: times }, (_, i) => ({
      freq: i % 2 === 0 ? 740 : 587.33,
      start: i * 0.26,
      dur: 0.2,
    })),
    "square"
  );
}
