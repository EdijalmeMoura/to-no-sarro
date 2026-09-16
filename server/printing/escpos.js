// ============================================================
// TÔ NO SARRO — Impressão direta em impressora térmica (ESC/POS)
//
// Envia bytes crus por TCP (impressora de rede na porta 9100 — o
// padrão das térmicas 80mm e das caixinhas de rede). Sem
// dependências: só node:net.
//
//   npm: nada a instalar
//   hardware: impressora ESC/POS na mesma rede do servidor
// ============================================================

import net from "node:net";

// ESC/POS
const ESC = 0x1b;
const GS = 0x1d;

const WIDTH = 48; // colunas aproximadas de uma 80mm com fonte A

const strip = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

class EscposBuilder {
  constructor() {
    this.chunks = [Buffer.from([ESC, 0x40])]; // init
  }
  raw(...bytes) {
    this.chunks.push(Buffer.from(bytes));
    return this;
  }
  text(line = "") {
    this.chunks.push(Buffer.from(strip(line).slice(0, WIDTH * 2) + "\n", "ascii"));
    return this;
  }
  align(mode = "left") {
    // 0 esquerda, 1 centro, 2 direita
    return this.raw(ESC, 0x61, mode === "center" ? 1 : mode === "right" ? 2 : 0);
  }
  bold(on = true) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  size(double = false) {
    // GS ! n: bits 0-3 largura, 4-7 altura
    return this.raw(GS, 0x21, double ? 0x11 : 0x00);
  }
  divider(char = "-") {
    return this.text(char.repeat(WIDTH));
  }
  row(left, right, pad = ".") {
    const l = strip(left);
    const r = strip(right);
    const space = Math.max(1, WIDTH - l.length - r.length);
    return this.text(l + pad.repeat(space) + r);
  }
  feed(n = 3) {
    return this.raw(...Array(n).fill(0x0a));
  }
  cut() {
    // corte parcial
    return this.raw(GS, 0x56, 0x42, 0x00);
  }
  build() {
    return Buffer.concat(this.chunks);
  }
}

const brl = (n) =>
  "R$ " + Number(n || 0).toFixed(2).replace(".", ",");

const center = (b, txt, { double = false, bold = false } = {}) =>
  b.align("center").size(double).bold(bold).text(txt).size(false).bold(false).align("left");

const chName = (ch) => ({ DIRECT: "CARDÁPIO", IFOOD: "IFOOD", NNFOOD: "99FOOD", WHATSAPP: "WHATSAPP" }[ch] || ch);
const dt = (ts) =>
  new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function buildKitchenComanda(order) {
  const b = new EscposBuilder();
  center(b, "TÔ NO SARRO!", { double: true, bold: true });
  center(b, "COMANDA - COZINHA").divider();
  b.bold(true).size(true);
  b.align("left").text(`#${order.code} ${order.type === "pickup" ? "* RETIRADA" : "* DELIVERY"}`);
  b.size(false).bold(false);
  b.row(chName(order.channel), dt(order.createdAt)).divider();

  for (const i of order.items) {
    b.bold(true).size(true).text(`${i.qty}x ${i.name}`).size(false).bold(false);
    for (const op of i.opts || []) b.text(`  + ${op.name}`);
    if (i.note) {
      b.align("center").bold(true).text(`>>> OBS: ${i.note}`).bold(false).align("left");
    }
  }
  if (order.note) {
    b.divider("=").bold(true).text(`OBS GERAL: ${order.note}`).bold(false);
  }
  b.feed(4).cut();
  return b.build();
}

export function buildExpeditionComanda(order) {
  const b = new EscposBuilder();
  center(b, "TÔ NO SARRO!", { double: true, bold: true });
  center(b, "EXPEDICAO").divider();
  b.bold(true).size(true).text(`#${order.code}`).size(false).bold(false);
  b.row(chName(order.channel), dt(order.createdAt)).divider();
  b.bold(true).text("CLIENTE:").bold(false).text(order.customer.name);
  b.text(`Tel: ${order.customer.phone}`);
  b.bold(true).text(order.type === "pickup" ? "RETIRADA NA LOJA" : "ENTREGAR EM:").bold(false);
  b.text(order.customer.addr).divider();
  for (const i of order.items) b.text(`${i.qty}x ${i.name}`);
  b.divider();
  b.row("PAGAMENTO", order.payment);
  b.row("TOTAL", brl(order.total), " ");
  b.feed(4).cut();
  return b.build();
}

export function buildLabel(order) {
  const b = new EscposBuilder();
  center(b, `SARRO #${order.code}`, { double: true, bold: true }).divider();
  b.bold(true).size(true).text(order.customer.name).size(false).bold(false);
  b.text(order.customer.phone);
  b.text(order.type === "pickup" ? "RETIRADA NA LOJA" : order.customer.addr).divider();
  for (const i of order.items) b.text(`${i.qty}x ${i.name}`);
  b.feed(4).cut();
  return b.build();
}

export function buildTestPage(storeName = "TÔ NO SARRO!") {
  const b = new EscposBuilder();
  center(b, strip(storeName), { double: true, bold: true });
  center(b, "Impressora conectada!").divider();
  b.row("Teste de impressao", dt(Date.now()));
  b.row("Caracteres", "0123456789").row("Simbolos", "!@#$%&*()-+");
  b.text("Se voce leu isto, a integracao com a termica funciona.").feed(4).cut();
  return b.build();
}

// Envio cru por TCP — impressoras de rede escutam a 9100
export function sendRaw(host, port, buffer, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) || 9100 });
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      socket.write(buffer, () => {
        // pequena espera para a impressora drenar o buffer antes de fechar
        setTimeout(() => finish(null), 150);
      });
    });
    socket.on("timeout", () => finish(new Error(`Impressora ${host} não respondeu (timeout)`)));
    socket.on("error", (e) => finish(new Error(`Sem conexão com ${host}:${port} — ${e.message}`)));
    socket.on("close", () => finish(null));
  });
}
