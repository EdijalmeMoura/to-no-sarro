export function printHTML(body) {
  const w = window.open("", "_blank", "width=360,height=640");
  if (!w) return;
  w.document.write(`<html><head><title>Impressão</title></head><body>${body}</body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 300);
}

export function printKitchen(o) {
  const items = (o.items || []).map(i => `${i.qty}x ${i.name}${i.note?` (${i.note})`:""}`).join("<br/>");
  printHTML(`
    <div style="font-family:monospace; padding:10px; font-size:13px;">
      <h3>COZINHA #${o.code}</h3>
      <div>${o.customer?.name || ""} - ${o.customer?.addr || ""}</div>
      <div style="margin:8px 0; border-top:1px dashed #000; padding-top:6px;">${items}</div>
      <div style="font-size:11px; color:#555;">${o.note || ""}</div>
    </div>
  `);
}

export function printExpedition(o) {
  printHTML(`
    <div style="font-family:sans-serif; padding:10px;">
      <h3>EXPEDIÇÃO #${o.code}</h3>
      <div>${o.customer?.name}</div>
      <div>${o.customer?.addr}</div>
      <div>${o.customer?.phone}</div>
    </div>
  `);
}

export function printReceipt(o, settings = {}) {
  const items = (o.items || []).map(i => `<div>${i.qty}x ${i.name} - ${(i.unit*i.qty).toFixed(2)}</div>`).join("");
  printHTML(`<div style="font-family:monospace; padding:10px;"><h3>RECIBO #${o.code}</h3>${items}<div>Total: R$ ${o.total?.toFixed(2)}</div></div>`);
}

export function printLabel(o) {
  printHTML(`<div style="font-family:sans-serif; padding:10px; text-align:center;"><h2>#${o.code}</h2><div>${o.customer?.name}</div></div>`);
}

export function printCashSummaryReceipt(reg, settings = {}) {
  printHTML(`<div style="font-family:monospace; padding:10px;"><h3>FECHAMENTO CAIXA</h3><div>${JSON.stringify(reg?.summary || {})}</div></div>`);
}

export function printDriverSettlementReceipt(settlement, settings = {}) {
  printHTML(`<div style="font-family:monospace; padding:10px;"><h3>ACERTO ENTREGADOR</h3><div>${settlement?.driver_id}</div></div>`);
}

export function buildGoogleMapsMultiStopUrl(orders, storeAddress = "Rua do Sol, Janga, Paulista - PE") {
  const addrs = orders.map(o => encodeURIComponent(o.customer?.addr || "")).join("/");
  return `https://www.google.com/maps/dir/${encodeURIComponent(storeAddress)}/${addrs}`;
}

export function downloadCSV(name, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function printReport(title, cols, rows) {
  const head = cols.map(c => `<th>${c}</th>`).join("");
  const body = rows.map(r => `<tr>${r.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("");
  printHTML(`<div><h3>${title}</h3><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
}
