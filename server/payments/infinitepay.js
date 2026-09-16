// ============================================================
// TÔ NO SARRO — Camada de pagamento desacoplada
// Provedor: InfinitePay (Checkout Integrado — Pix e Cartão)
//
// Fluxo:
//   1. createCheckoutLink() gera o link de pagamento na InfinitePay
//   2. Cliente paga (Pix ou cartão) na página segura deles
//   3. Webhook deles avisa nosso servidor → validamos com
//      paymentCheck() (server-to-server) antes de confirmar
//   4. Pedido muda para CONFIRMADO e vai pra cozinha
//
// Trocar de gateway no futuro = criar outro módulo com estas
// mesmas duas funções e registrar as rotas dele.
// ============================================================

const CHECKOUT_API = "https://api.checkout.infinitepay.io";

export const cents = (v) => Math.round(Number(v) * 100);

export async function createCheckoutLink({ handle, orderNsu, items, webhookUrl, redirectUrl }) {
  const body = {
    handle,
    order_nsu: orderNsu,
    items,
  };
  if (webhookUrl) body.webhook_url = webhookUrl;
  if (redirectUrl) body.redirect_url = redirectUrl;

  const r = await fetch(`${CHECKOUT_API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`InfinitePay recusou o link (${r.status}): ${text.slice(0, 180)}`);
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("InfinitePay devolveu resposta inválida."); }
  if (!data.url) throw new Error("InfinitePay não devolveu a URL de pagamento.");
  return data.url;
}

export async function paymentCheck({ handle, orderNsu, slug, transactionNsu }) {
  const body = { handle, order_nsu: orderNsu };
  if (slug) body.slug = slug;
  if (transactionNsu) body.transaction_nsu = transactionNsu;

  const r = await fetch(`${CHECKOUT_API}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`payment_check ${r.status}: ${text.slice(0, 140)}`);
  return JSON.parse(text);
  // { success, paid, amount, paid_amount, installments, capture_method }
}
