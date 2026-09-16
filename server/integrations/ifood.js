// ============================================================
// TÔ NO SARRO — Integração iFood (API oficial de merchant)
//
// Autenticação client-credentials + polling de eventos + ack,
// conforme o padrão da plataforma do iFood. Pedidos (evento PLC)
// entram no fluxo interno com canal IFOOD; mudanças de status no
// admin espelham para o iFood (confirm / readyToPickup / dispatch).
//
// Credenciais ficam nas configurações do servidor — nunca no
// frontend. Sem rede/credenciais, o poller registra o erro no
// diário de integrações e continua tentando.
// ============================================================

const API = "https://merchant-api.ifood.com.br";

// Eventos de interesse: PLC=pedido criado, CON=confirmado, CAN=cancelado
const POLL_TYPES = "PLC,CON,CAN";

let tokenCache = { key: "", token: "", expiresAt: 0 };

export async function getToken(creds) {
  const key = `${creds.clientId}:${creds.clientSecret}`;
  if (tokenCache.token && tokenCache.key === key && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }
  const body = new URLSearchParams({
    grantType: "client_credentials",
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  });
  const r = await fetch(`${API}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.accessToken) {
    throw new Error(data?.error?.message || data?.error_description || `auth HTTP ${r.status}`);
  }
  tokenCache = { key, token: data.accessToken, expiresAt: Date.now() + (data.expiresIn || 3600) * 1000 };
  return tokenCache.token;
}

async function api(creds, path, opts = {}, retry = true) {
  const token = await getToken(creds);
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (r.status === 401 && retry) {
    tokenCache = { key: "", token: "", expiresAt: 0 };
    return api(creds, path, opts, false);
  }
  return r;
}

// Busca novos eventos e já reconhece (ack) para não reentregarem
export async function pollEvents(creds) {
  const r = await api(creds, `/v1.0/events:polling?types=${POLL_TYPES}`);
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`polling HTTP ${r.status}`);
  const events = await r.json();
  if (Array.isArray(events) && events.length) {
    await api(creds, "/v1.0/events/acknowledgment", {
      method: "POST",
      body: JSON.stringify(events.map((e) => ({ id: e.id }))),
    });
  }
  return events;
}

export async function getOrderDetails(creds, orderId) {
  const r = await api(creds, `/v1.0/orders/${orderId}`);
  if (!r.ok) throw new Error(`order HTTP ${r.status}`);
  return r.json();
}

async function statusCall(creds, orderId, action) {
  const r = await api(creds, `/v1.0/orders/${orderId}/${action}`, { method: "POST" });
  if (!r.ok && r.status !== 409) throw new Error(`${action} HTTP ${r.status}`);
  return true;
}

export const confirmOrder = (creds, id) => statusCall(creds, id, "confirm");
export const readyToPickup = (creds, id) => statusCall(creds, id, "readyToPickup");
export const dispatchOrder = (creds, id) => statusCall(creds, id, "dispatch");

// Mapeia o pedido do iFood para o formato interno
export function mapIfoodOrder(details) {
  const items = (details.items || []).map((it) => ({
    externalId: it.externalCode || it.id,
    name: it.name,
    qty: it.quantity,
    unit: it.unitPrice ?? (it.totalPrice || 0) / Math.max(1, it.quantity),
    note: (it.observations || "").slice(0, 140),
    options: (it.subItems || []).map((s) => ({ name: s.name, price: (s.totalPrice || 0) / Math.max(1, s.quantity || 1) })),
  }));
  const payMethod = details.payments?.methods?.[0];
  return {
    extRef: details.id,
    customer: {
      name: details.customer?.name || "Cliente iFood",
      phone: details.customer?.phoneNumber || "",
      addr: details.deliveryAddress
        ? [details.deliveryAddress.streetAddress, details.deliveryAddress.number]
            .filter(Boolean).join(", ") +
          (details.deliveryAddress.neighborhood ? ` — ${details.deliveryAddress.neighborhood}` : "")
        : "Retirada na loja",
    },
    items,
    payment: payMethod?.name || payMethod?.method || "Cartão (iFood)",
    type: details.deliveryAddress ? "delivery" : "pickup",
    subtotal: details.subTotal ?? details.total?.subTotal ?? 0,
    fee: details.deliveryFee ?? details.total?.deliveryFee ?? 0,
    discount: details.benefits?.reduce((s, b) => s + (b.value || 0), 0) || 0,
  };
}
