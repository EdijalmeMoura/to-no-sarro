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
import AdminOrders from "./AdminOrders.jsx";
import AdminUsers from "./AdminUsers.jsx";
import TVPanelApp from "../tv/TVPanelApp.jsx";
import DriverApp from "../driver/DriverApp.jsx";
import DriverSettlementModal from "../driver/DriverSettlementModal.jsx";
import SettlementsHistoryModal from "../driver/SettlementsHistoryModal.jsx";

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
  { id: "paineltv", label: "Painel TV", icon: "📺" },
  { id: "entregadores", label: "Entregadores", icon: "🛵" },
  { id: "integracoes", label: "Integrações", icon: "🔌" },
  { id: "config", label: "Configurações", icon: "⚙️" },
];

function AdminSettingsModular({ store, now }) {
  return (
    <div className="space-y-4">
      <AdminModalitiesCard store={store} />

      <div className="grid lg:grid-cols-2 gap-3">
        <AdminPaymentsCard store={store} />
        <AdminPrinterCard store={store} />
        <AdminStoreCard store={store} />
        <ServiceChargeCard store={store} />
      </div>

      {/* USUÁRIOS E PERMISSÕES - sempre visível */}
      <Card className="p-4" style={{ borderColor: `${C.orange}44` }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: 18 }}>👥</span>
          <div style={{ color: C.white, fontWeight: 900, fontSize: 15 }}>Usuários e permissões</div>
          <span className="ml-auto rounded-full px-2 py-0.5 font-bold" style={{ background: `${C.orange}22`, color: C.orange, fontSize: 10, border: `1px solid ${C.orange}44` }}>
            ADMIN
          </span>
        </div>
        <div style={{ color: "#8a8a8a", fontSize: 11.5, marginBottom: 12, lineHeight: 1.4 }}>
          Gerencie acessos da equipe: cozinha, expedição, entregadores, gerente e admin. O botão <strong style={{ color: C.white }}>+ Novo usuário</strong> cria login com senha, perfil e vínculo com entregador quando for ENTREGADOR. Toggle ativa/desativa, ✎ editar, 🗑 excluir.
        </div>
        <AdminUsers store={store} now={now} />
      </Card>

      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 900, fontSize: 13, marginBottom: 8 }}>Perfis disponíveis</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            ["ADMIN", "Administrador", "Acesso total, incluindo usuários, financeiro e integrações"],
            ["GERENTE", "Gerente", "Tudo, exceto gerenciar usuários"],
            ["COZINHA", "Cozinha", "Somente painel da cozinha — iniciar preparo, marcar pronto, cancelar"],
            ["EXPEDICAO", "Expedição", "Pedidos prontos e atribuição de entregador"],
            ["ATENDIMENTO", "Atendimento", "Pedidos, clientes e cupons"],
            ["ENTREGADOR", "Entregador", "Somente as próprias entregas vinculadas"],
          ].map(([role, label, desc]) => (
            <div key={role} className="rounded-xl p-3" style={{ background: C.gray850, border: `1px solid ${C.gray800}` }}>
              <div style={{ color: C.white, fontWeight: 800, fontSize: 12 }}>{label} <span style={{ color: "#666", fontSize: 10 }}>({role})</span></div>
              <div style={{ color: "#8a8a8a", fontSize: 11, marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg px-3 py-2" style={{ background: `${C.orange}12`, border: `1px solid ${C.orange}33`, color: C.orange, fontSize: 11 }}>
          💡 Contas padrão: <strong>admin/admin123</strong>, <strong>cozinha/cozinha123</strong>, <strong>expedicao/expedicao123</strong>, <strong>rafael/entregador123</strong>, <strong>jonas/entregador123</strong>, <strong>bia/entregador123</strong> — se não aparecerem, o banco será re-semeado no próximo boot do servidor via ensureDefaultUsers().
        </div>
      </Card>
    </div>
  );
}

function AdminDriversSection({ store, now }) {
  const drivers = store.drivers || [];
  const [acertoDe, setAcertoDe] = useState(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div style={{ color: C.white, fontWeight: 900, fontSize: 16 }}>🛵 Entregadores</div>
          <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 2 }}>{drivers.length} cadastrados · gestão de rotas e acertos</div>
        </div>
        <div className="flex gap-2">
          <Btn small variant="dark" onClick={() => setHistoricoAberto(true)}>📋 Histórico de acertos</Btn>
          <Btn small variant="dark" onClick={() => window.open("/entregador", "_blank")}>Abrir painel entregador ↗</Btn>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {drivers.map((d) => {
          const pending = store.orders.filter((o) => o.driverId === d.id && o.status === "ROTA").length;
          const delivered = store.orders.filter((o) => o.driverId === d.id && o.status === "ENTREGUE").length;
          return (
            <Card key={d.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full flex items-center justify-center" style={{ width: 44, height: 44, background: C.gray800, fontSize: 22 }}>🛵</div>
                <div className="flex-1 min-w-0">
                  <div style={{ color: C.white, fontWeight: 900, fontSize: 14 }} className="truncate">{d.name}</div>
                  <div style={{ color: "#8a8a8a", fontSize: 11 }} className="truncate">{d.vehicle} · {d.phone} · {d.status}</div>
                </div>
                <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: d.status === "livre" ? `${C.green}22` : `${C.orange}22`, color: d.status === "livre" ? C.green : C.orange, fontSize: 10 }}>{d.status?.toUpperCase()}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <div className="flex-1 rounded-lg p-2 text-center" style={{ background: C.gray850 }}>
                  <div style={{ color: C.orange, fontWeight: 900, fontSize: 16 }}>{pending}</div>
                  <div style={{ color: "#8a8a8a", fontSize: 10 }}>EM ROTA</div>
                </div>
                <div className="flex-1 rounded-lg p-2 text-center" style={{ background: C.gray850 }}>
                  <div style={{ color: C.green, fontWeight: 900, fontSize: 16 }}>{delivered}</div>
                  <div style={{ color: "#8a8a8a", fontSize: 10 }}>ENTREGUES</div>
                </div>
                <div className="flex-1 rounded-lg p-2 text-center" style={{ background: C.gray850 }}>
                  <div style={{ color: C.white, fontWeight: 900, fontSize: 16 }}>{d.deliveries || 0}</div>
                  <div style={{ color: "#8a8a8a", fontSize: 10 }}>TOTAL</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Btn small full onClick={() => setAcertoDe(d)}>🤝 Fechar acerto</Btn>
                <Btn small variant="dark" onClick={() => window.open("/entregador", "_blank")}>🛵 Área</Btn>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <div style={{ color: C.white, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Preview área do entregador</div>
        <div style={{ color: "#8a8a8a", fontSize: 12, marginBottom: 10 }}>Como o entregador vê seus pedidos. Use /entregador para login real (rafael/entregador123).</div>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.gray800}`, maxHeight: 520, overflow: "auto" }}>
          <DriverApp store={store} now={now} driverOverride={drivers[0] || null} preview />
        </div>
      </Card>

      {acertoDe && (
        <DriverSettlementModal
          driver={acertoDe}
          store={store}
          onClose={() => setAcertoDe(null)}
        />
      )}
      {historicoAberto && <SettlementsHistoryModal store={store} onClose={() => setHistoricoAberto(false)} />}
    </div>
  );
}

export default function AdminApp({ store, now }) {
  const [sec, setSec] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const tablesOn = !!store.settings?.tablesEnabled;
  const navItems = ADMIN_NAV;
  const title = ADMIN_NAV.find((n) => n.id === sec)?.label || "Admin";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.black }}>
      {/* SIDEBAR - sem toggle de mesas */}
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

        <nav className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar pr-1">
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
                {isMesas && !tablesOn && (
                  <span className="ml-auto text-[9px] font-bold rounded-full px-1.5 py-0.5" style={{ background: C.gray700, color: "#777" }}>
                    OFF
                  </span>
                )}
              </button>
            );
          })}
        </nav>

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

      {/* MAIN */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6" style={{ background: C.black }}>
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <button className="md:hidden shrink-0" onClick={() => setMenu(!menu)} style={{ color: C.white, fontSize: 20 }}>☰</button>
            <h2 style={{ fontFamily: font.display, fontStyle: "italic", fontSize: 20, color: C.white, letterSpacing: "-0.02em" }} className="sm:text-[24px] truncate">
              {title.toUpperCase()}
            </h2>
            {sec === "mesas" && !tablesOn && <span className="ml-2 text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ background: `${C.red}22`, color: C.red }}>DESATIVADO</span>}
          </div>
          <div className="flex items-center gap-2">
            {sec === "paineltv" && <Btn small variant="dark" onClick={() => window.open("/paineltv", "_blank")}>Abrir em nova aba ↗</Btn>}
            {sec === "entregadores" && <Btn small variant="dark" onClick={() => window.open("/entregador", "_blank")}>Painel entregador ↗</Btn>}
          </div>
        </div>

        {menu && (
          <div className="md:hidden grid grid-cols-2 gap-2 mb-4">
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => { setSec(n.id); setMenu(false); }}
                className="rounded-xl px-3 py-2.5 text-left flex items-center gap-2"
                style={{ background: sec === n.id ? `${C.orange}1c` : C.gray850, color: sec === n.id ? C.orange : "#c0c0c0", fontSize: 12.5, fontWeight: 700 }}
              >
                <span>{n.icon}</span><span className="truncate">{n.label}</span>
              </button>
            ))}
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
                O atendimento em mesas está desativado. Ative em Configurações → Modalidades → Mesas / Salão.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Btn variant="primary" onClick={() => setSec("config")}>Ir para Configurações</Btn>
                <Btn variant="dark" onClick={() => window.open("/mesas", "_blank")}>Preview mesas</Btn>
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
        {sec === "paineltv" && <TVPanelApp store={store} now={now} />}
        {sec === "entregadores" && <AdminDriversSection store={store} now={now} />}
        {sec === "integracoes" && <AdminIntegrations store={store} />}
        {sec === "config" && <AdminSettingsModular store={store} now={now} />}
      </main>
    </div>
  );
}
