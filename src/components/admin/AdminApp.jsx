import React, { useState } from "react";
import { C, font } from "../../constants/theme.js";
import { Card, Btn, Logo } from "../ui/index.jsx";
import { api } from "../../utils/api.js";
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
import AdminOrders from "./AdminOrders.jsx";

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
    <div className="space-y-3">
      {/* MODALIDADES - primeiro e em destaque, ocupa largura total */}
      <AdminModalitiesCard store={store} />
      <div className="grid lg:grid-cols-2 gap-3">
        <AdminPaymentsCard store={store} />
        <AdminPrinterCard store={store} />
        <AdminStoreCard store={store} />
        <ServiceChargeCard store={store} />
        <Card className="p-4 lg:col-span-2">
          <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }}>Configurações gerais</div>
          <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 4 }}>Outras configurações do sistema.</div>
        </Card>
      </div>
    </div>
  );
}

export default function AdminApp({ store, now }) {
  const [sec, setSec] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const tablesOn = !!store.settings?.tablesEnabled;
  // Mostrar mesas sempre no menu, mas com indicação visual se desativado
  const navItems = ADMIN_NAV;
  const title = ADMIN_NAV.find((n) => n.id === sec)?.label || "Admin";

  const toggleTablesQuick = async () => {
    try {
      const next = !tablesOn;
      await api("/api/settings", { method: "PATCH", body: { tables_enabled: next } });
      store.toast(next ? "🍽️ Mesas ATIVADO!" : "🍽️ Mesas desativado");
    } catch (e) {
      store.toast(e.message);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.black }}>
      {/* SIDEBAR - sem rolagem, altura total, overflow hidden */}
      <aside
        className="hidden md:flex flex-col shrink-0 p-3"
        style={{ width: 220, background: C.gray900, borderRight: `1px solid ${C.gray800}`, height: "100vh", overflow: "hidden" }}
      >
        <div className="shrink-0">
          <Logo size={36} />
          <div style={{ color: "#5a5a5a", fontSize: 9, marginTop: 8, marginBottom: 12, letterSpacing: "0.04em" }}>
            SMART FOOD SYSTEM
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-hidden pr-1">
          {navItems.map((n) => {
            const isMesas = n.id === "mesas";
            const disabled = isMesas && !tablesOn;
            return (
              <button
                key={n.id}
                onClick={() => setSec(n.id)}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition"
                style={{
                  background: sec === n.id ? `${C.orange}1c` : "transparent",
                  color: sec === n.id ? C.orange : disabled ? "#555" : "#9a9a9a",
                  fontWeight: sec === n.id ? 800 : 600, fontSize: 12.5,
                  borderLeft: `2px solid ${sec === n.id ? C.orange : "transparent"}`,
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <span className="shrink-0">{n.icon}</span>
                <span className="truncate flex-1">{n.label}</span>
                {isMesas && (
                  <span className="ml-auto text-[9px] font-bold rounded-full px-1.5 py-0.5" style={{ background: tablesOn ? `${C.green}22` : `${C.gray700}`, color: tablesOn ? C.green : "#777" }}>
                    {tablesOn ? "ON" : "OFF"}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Toggle rápido de mesas - sempre visível no sidebar */}
        <div className="shrink-0 mt-2 p-2.5 rounded-xl" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div style={{ color: C.white, fontWeight: 800, fontSize: 11.5 }} className="truncate">🍽️ Mesas</div>
              <div style={{ color: tablesOn ? C.green : "#777", fontSize: 10, fontWeight: 700 }}>{tablesOn ? "ATIVAS" : "DESATIVADAS"}</div>
            </div>
            <button
              onClick={toggleTablesQuick}
              className="rounded-full shrink-0 transition"
              style={{ width: 36, height: 20, background: tablesOn ? C.green : C.gray700, position: "relative" }}
              title={tablesOn ? "Desativar mesas" : "Ativar mesas"}
            >
              <span style={{ position: "absolute", top: 2, left: tablesOn ? 18 : 2, width: 16, height: 16, borderRadius: 99, background: C.white, transition: "left .2s" }} />
            </button>
          </div>
        </div>

        <div className="shrink-0 rounded-xl p-2.5 mt-2 flex items-center justify-between" style={{ background: C.gray850 }}>
          <div className="min-w-0">
            <div style={{ color: "#8a8a8a", fontSize: 10 }}>Conectado</div>
            <div style={{ color: C.white, fontWeight: 800, fontSize: 12 }} className="truncate">{store.me?.name?.split(" ")[0] || "Admin"}</div>
          </div>
          {store.me && (
            <button onClick={store.logout} className="rounded-lg px-2 py-1 font-bold text-[11px] shrink-0" style={{ border: `1px solid ${C.gray800}`, color: "#9a9a9a" }}>Sair</button>
          )}
        </div>
      </aside>

      {/* MAIN - único com rolagem */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6" style={{ background: C.black }}>
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden shrink-0" onClick={() => setMenu(!menu)} style={{ color: C.white, fontSize: 20 }}>☰</button>
            <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white, letterSpacing: "-0.02em" }} className="sm:text-[24px] truncate">
              {title.toUpperCase()}
            </h2>
            {sec === "mesas" && !tablesOn && <span className="ml-2 text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: `${C.red}22`, color: C.red }}>DESATIVADO</span>}
          </div>
        </div>

        {menu && (
          <div className="md:hidden grid grid-cols-2 gap-2 mb-4">
            {navItems.map((n) => {
              const isMesas = n.id === "mesas";
              const disabled = isMesas && !tablesOn;
              return (
                <button
                  key={n.id}
                  onClick={() => { setSec(n.id); setMenu(false); }}
                  className="rounded-xl px-3 py-2.5 text-left flex items-center gap-2"
                  style={{ background: sec === n.id ? `${C.orange}1c` : C.gray850, color: sec === n.id ? C.orange : disabled ? "#555" : "#c0c0c0", fontSize: 12.5, fontWeight: 700 }}
                >
                  <span>{n.icon}</span><span className="truncate">{n.label}</span>
                  {isMesas && <span className="ml-auto text-[9px]">{tablesOn ? "ON" : "OFF"}</span>}
                </button>
              );
            })}
            {/* Toggle mobile */}
            <button onClick={toggleTablesQuick} className="col-span-2 rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <span style={{ color: C.white, fontSize: 12.5, fontWeight: 700 }}>🍽️ Mesas {tablesOn ? "ATIVAS" : "DESATIVADAS"}</span>
              <span className="rounded-full" style={{ width: 36, height: 20, background: tablesOn ? C.green : C.gray700, position: "relative", display: "inline-block" }}>
                <span style={{ position: "absolute", top: 2, left: tablesOn ? 18 : 2, width: 16, height: 16, borderRadius: 99, background: C.white }} />
              </span>
            </button>
          </div>
        )}

        {sec === "dashboard" && <AdminDashboard store={store} now={now} setSec={setSec} />}
        {sec === "pedidos" && <AdminOrders store={store} now={now} />}
        {sec === "caixa" && <AdminCashRegister store={store} now={now} />}
        {sec === "mesas" && (
          tablesOn ? (
            <AdminTables store={store} now={now} />
          ) : (
            <Card className="p-6 sm:p-8 text-center max-w-md mx-auto my-8 sm:my-12">
              <div className="text-4xl mb-3">🍽️</div>
              <div style={{ color: C.white, fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Módulo de Mesas Desativado</div>
              <p style={{ color: "#8a8a8a", fontSize: 13, marginBottom: 16 }}>
                O atendimento em mesas está desativado. Ative no botão abaixo ou em Configurações.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Btn variant="primary" onClick={toggleTablesQuick}>🍽️ Ativar Mesas Agora</Btn>
                <Btn variant="dark" onClick={() => setSec("config")}>Ir para Configurações</Btn>
              </div>
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
