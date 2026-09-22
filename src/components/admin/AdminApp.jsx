import React, { useState } from "react";
import { C, font } from "../../constants/theme.js";
import { Card, Btn, Logo } from "../ui/index.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import AdminCashRegister from "./AdminCashRegister.jsx";
import AdminProducts from "./AdminProducts.jsx";
import AdminCustomers from "./AdminCustomers.jsx";
import AdminFinance from "./AdminFinance.jsx";
import AdminReports from "./AdminReports.jsx";
import AdminPromos from "./AdminPromos.jsx";
import AdminCategories from "./AdminCategories.jsx";
import AdminInventory from "./AdminInventory.jsx";
import AdminIntegrations from "./AdminIntegrations.jsx";
import AdminPaymentsCard from "./AdminPaymentsCard.jsx";
import AdminPrinterCard from "./AdminPrinterCard.jsx";
import AdminStoreCard from "./AdminStoreCard.jsx";
import AdminModalitiesCard from "./AdminModalitiesCard.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";
import AdminTables from "../tables/AdminTables.jsx";

// Fallback components for those not yet modularized
function AdminOrdersFallback({ store, now }) {
  const { orders = [] } = store;
  return (
    <div className="space-y-3">
      <div style={{ color: "#8a8a8a", fontSize: 12 }}>{orders.length} pedidos no total</div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {orders.slice(0, 20).map((o) => (
          <Card key={o.id} className="p-3">
            <div style={{ color: C.white, fontWeight: 800, fontSize: 13 }}>#{o.code} · {o.status}</div>
            <div style={{ color: "#8a8a8a", fontSize: 11 }}>{o.customer?.name} · {o.total}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminUsersFallback({ store }) {
  return <div style={{ color: "#8a8a8a", fontSize: 12 }}>Usuários gerenciados no App.jsx principal.</div>;
}

const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "pedidos", label: "Pedidos", icon: "🧾" },
  { id: "caixa", label: "Caixa / PDV", icon: "💵" },
  { id: "mesas", label: "Mesas / Salão", icon: "🍽️" },
  { id: "produtos", label: "Produtos", icon: "🍔" },
  { id: "categorias", label: "Categorias", icon: "📂" },
  { id: "clientes", label: "Clientes", icon: "👥" },
  { id: "promos", label: "Promoções", icon: "🏷️" },
  { id: "estoque", label: "Estoque", icon: "📦" },
  { id: "financeiro", label: "Financeiro", icon: "💰" },
  { id: "relatorios", label: "Relatórios", icon: "📈" },
  { id: "integracoes", label: "Integrações", icon: "🔌" },
  { id: "config", label: "Configurações", icon: "⚙️" },
];

function AdminSettingsModular({ store, now }) {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <AdminPaymentsCard store={store} />
      <AdminPrinterCard store={store} />
      <AdminStoreCard store={store} />
      <AdminModalitiesCard store={store} />
      <ServiceChargeCard store={store} />
      <Card className="p-4 lg:col-span-2">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Configurações gerais</div>
        <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 4 }}>Gerenciamento completo no App principal.</div>
      </Card>
    </div>
  );
}

function AdminApp({ store, now }) {
  const [sec, setSec] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const navItems = ADMIN_NAV.filter((n) => n.id !== "mesas" || store.settings?.tablesEnabled);
  const title = navItems.find((n) => n.id === sec)?.label || ADMIN_NAV.find((n) => n.id === sec)?.label || "Admin";

  return (
    <div className="flex" style={{ background: C.black, minHeight: "100%" }}>
      <aside
        className="hidden md:flex flex-col shrink-0 p-4"
        style={{ width: 216, background: C.gray900, borderRight: `1px solid ${C.gray800}`, minHeight: "100%" }}
      >
        <Logo size={38} />
        <div style={{ color: "#5a5a5a", fontSize: 9.5, marginTop: 10, marginBottom: 18, letterSpacing: "0.04em" }}>
          SMART FOOD SYSTEM
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map((n) => (
            <button
              key={n.id}
              onClick={() => setSec(n.id)}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left"
              style={{
                background: sec === n.id ? `${C.orange}1c` : "transparent",
                color: sec === n.id ? C.orange : "#9a9a9a",
                fontWeight: sec === n.id ? 800 : 600, fontSize: 13,
                borderLeft: `2px solid ${sec === n.id ? C.orange : "transparent"}`,
              }}
            >
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: C.gray850 }}>
          <div>
            <div style={{ color: "#8a8a8a", fontSize: 10.5 }}>Conectado como</div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 12.5 }}>{store.me?.name?.split(" ")[0] || "Administrador"}</div>
          </div>
          {store.me && (
            <button
              onClick={store.logout}
              className="rounded-lg px-2 py-1 font-bold text-xs"
              style={{ border: `1px solid ${C.gray800}`, color: "#9a9a9a" }}
            >
              Sair
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMenu(!menu)} style={{ color: C.white, fontSize: 20 }}>☰</button>
            <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 24, color: C.white, letterSpacing: "-0.02em" }}>
              {title.toUpperCase()}
            </h2>
          </div>
        </div>

        {menu && (
          <div className="md:hidden grid grid-cols-2 gap-2 mb-5">
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => { setSec(n.id); setMenu(false); }}
                className="rounded-xl px-3 py-2.5 text-left"
                style={{ background: sec === n.id ? `${C.orange}1c` : C.gray850, color: sec === n.id ? C.orange : "#c0c0c0", fontSize: 12.5, fontWeight: 700 }}
              >
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        )}

        {sec === "dashboard" && <AdminDashboard store={store} now={now} setSec={setSec} />}
        {sec === "pedidos" && <AdminOrdersFallback store={store} now={now} />}
        {sec === "caixa" && <AdminCashRegister store={store} now={now} />}
        {sec === "mesas" && (
          store.settings?.tablesEnabled ? (
            <AdminTables store={store} now={now} />
          ) : (
            <Card className="p-8 text-center max-w-md mx-auto my-12">
              <div className="text-4xl mb-3">🍽️</div>
              <div style={{ color: C.white, fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Módulo de Mesas Desativado</div>
              <p style={{ color: "#8a8a8a", fontSize: 13, marginBottom: 16 }}>
                O atendimento em mesas e salão está desativado nas configurações do sistema.
              </p>
              <Btn variant="primary" onClick={() => setSec("config")}>Ir para Configurações</Btn>
            </Card>
          )
        )}
        {sec === "produtos" && <AdminProducts store={store} />}
        {sec === "categorias" && <AdminCategories store={store} />}
        {sec === "clientes" && <AdminCustomers store={store} />}
        {sec === "promos" && <AdminPromos store={store} now={now} />}
        {sec === "estoque" && <AdminInventory store={store} />}
        {sec === "financeiro" && <AdminFinance store={store} now={now} />}
        {sec === "relatorios" && <AdminReports store={store} now={now} />}
        {sec === "integracoes" && <AdminIntegrations store={store} />}
        {sec === "config" && <AdminSettingsModular store={store} now={now} />}
      </main>
    </div>
  );
}

export default AdminApp;
