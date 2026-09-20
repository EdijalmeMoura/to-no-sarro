// ============================================================
// PIX ESTÁTICO (PADRÃO BR CODE / BANCO CENTRAL DO BRASIL)
// Gera o payload oficial EMV para "Pix Copia e Cola" e QR Code.
// ============================================================

export function crc16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emvField(id, val) {
  const str = String(val);
  const len = String(str.length).padStart(2, "0");
  return `${id}${len}${str}`;
}

export function generatePixBRCode({ key, name = "TO NO SARRO", city = "PAULISTA", amount, txid = "***" }) {
  if (!key) return null;
  const cleanKey = String(key).trim();
  const merchantAccount = emvField("00", "br.gov.bcb.pix") + emvField("01", cleanKey);
  const cleanName = (name || "TO NO SARRO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 25)
    .toUpperCase();
  const cleanCity = (city || "PAULISTA")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 15)
    .toUpperCase();
  const amtStr = Number(amount || 0).toFixed(2);
  const cleanTxid = (txid || "***").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";
  const addData = emvField("05", cleanTxid);

  let payload =
    emvField("00", "01") +
    emvField("26", merchantAccount) +
    emvField("52", "0000") +
    emvField("53", "986") +
    emvField("54", amtStr) +
    emvField("58", "BR") +
    emvField("59", cleanName) +
    emvField("60", cleanCity) +
    emvField("62", addData) +
    "6304";

  return payload + crc16(payload);
}
