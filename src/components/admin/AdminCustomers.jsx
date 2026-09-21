import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, font, STATUS, FLOW, CHANNELS } from "../../constants/theme.js";
import { brl, elapsed, fmtDT, fmtShort, toLocalInput, fromLocalInput, lastSeen, esc, channelName } from "../../utils/format.js";
import { api } from "../../utils/api.js";
import { printHTML, printKitchen, printExpedition, printReceipt, printLabel, printCashSummaryReceipt, printDriverSettlementReceipt, buildGoogleMapsMultiStopUrl, downloadCSV, printReport } from "../../utils/print.js";
import { getOrderModality } from "../../utils/orderModality.js";
import { buildMesaIndex, getOrderTableNumber } from "../../utils/mesa.js";
import { Card, Btn, KPI, BarChart, Donut, StatusPill, SyncBadge, ChannelPill, Badge, Logo, SmartImg } from "../ui/index.jsx";
import ServiceChargeCard from "./ServiceChargeCard.jsx";
import WaiterReport from "./WaiterReport.jsx";
import LowStockAlerts from "./LowStockAlerts.jsx";

function AdminCustomers({ store }) {
  const tierColor = { VIP: C.yellowLight, Recorrente: C.green, Novo: C.blue, Inativo: "#7a7a7a" };
  return (
    <Card className="p-1">
      <Table
        cols={["Cliente", "WhatsApp", "Pedidos", "Gasto", "Ticket médio", "Último", "Classificação"]}
        rows={store.customers.map((c) => [
          c.name, c.phone, c.orders, brl(c.spent), brl(c.spent / c.orders), c.last,
          <span key="t" style={{ color: tierColor[c.tier], fontWeight: 800, fontSize: 11.5 }}>{c.tier.toUpperCase()}</span>,
        ])}
      />
    </Card>
  );
}


export default AdminCustomers;
