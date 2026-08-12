import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import StatusFooter from "./components/StatusFooter";
import KpiCards from "./components/KpiCards";
import LiveForecourtMap from "./components/LiveForecourtMap";
import PumpOverviewTable from "./components/PumpOverviewTable";
import RightRail from "./components/RightRail";
import PlaceholderPage from "./components/PlaceholderPage";
import Login from "./pages/Login";
import Sales from "./pages/Sales";
import POS from "./pages/POS";
import Dispensers from "./pages/Dispensers";
import Nozzles from "./pages/Nozzles";
import FuelTanks from "./pages/FuelTanks";
import TankGauges from "./pages/TankGauges";
import Controllers from "./pages/Controllers";
import CashManagement from "./pages/CashManagement";
import Reports from "./pages/Reports";
import Analytics from "./pages/Analytics";
import Administration from "./pages/Administration";
import Shifts from "./pages/Shifts";
import CRM from "./pages/CRM";
import Deliveries from "./pages/Deliveries";
import FleetAccounts from "./pages/FleetAccounts";
import Inventory from "./pages/Inventory";
import Loyalty from "./pages/Loyalty";
import Maintenance from "./pages/Maintenance";
import PriceManagement from "./pages/PriceManagement";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import SystemHealth from "./pages/SystemHealth";
import AuditLogs from "./pages/AuditLogs";
import Alerts from "./pages/Alerts";
import Finance from "./pages/Finance";
import { INITIAL_PUMPS, INITIAL_EVENTS, NAV_GROUPS } from "./data/mock";
import type { Pump, ForecourtEvent } from "./types";
import { useAuth } from "./lib/AuthContext";
import { useApiData } from "./lib/useApiData";
import { usePumpTelemetry } from "./lib/usePumpTelemetry";
import { mergeLive } from "./lib/mergeLive";

const PAGE_LABEL: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))
);

interface DashboardKpis {
  salesToday: number;
  litresToday: number;
  transactionsToday: number;
  activeAlerts: number;
}

function DashboardPage({ onNavigate }: { onNavigate: (route: string) => void }) {
  // Initial snapshot over REST so the page paints immediately; the WebSocket
  // gateway then takes over with live per-second updates from the edge
  // service. If the WS drops, the REST snapshot (refetched periodically)
  // keeps things reasonably current rather than freezing.
  const { data: pumpSnapshot } = useApiData<Pump[]>("/dashboard/pumps", INITIAL_PUMPS);
  const { data: kpis } = useApiData<DashboardKpis>("/dashboard/kpis");
  const { data: events } = useApiData<ForecourtEvent[]>("/dashboard/events", INITIAL_EVENTS);
  const { pumps: livePumps, status: wsStatus } = usePumpTelemetry(true);

  const pumps = mergeLive(pumpSnapshot ?? INITIAL_PUMPS, livePumps);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-end -mb-1">
          <span className="flex items-center gap-1.5 text-[10.5px] text-text-faint">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wsStatus === "connected" ? "bg-success" : wsStatus === "connecting" ? "bg-warning" : "bg-danger"
              }`}
            />
            {wsStatus === "connected" ? "Live telemetry connected" : wsStatus === "connecting" ? "Connecting..." : "Telemetry offline \u2013 showing last snapshot"}
          </span>
        </div>
        <KpiCards
          pumps={pumps}
          dailyTotals={{
            litres: kpis?.litresToday ?? 0,
            kes: kpis?.salesToday ?? 0,
            transactions: kpis?.transactionsToday ?? 0,
            activeAlerts: kpis?.activeAlerts ?? 0,
          }}
        />
        <LiveForecourtMap pumps={pumps} />
        <PumpOverviewTable pumps={pumps} />
      </div>
      <RightRail pumps={pumps} events={events ?? INITIAL_EVENTS} onNavigate={onNavigate} />
    </div>
  );
}

function AppShell() {
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarDefaultApplied = useRef(false);

  // Applied here (not just when visiting Settings) so the saved theme takes
  // effect the moment the app loads, regardless of which page the user
  // lands on first.
  const { data: appearance } = useApiData<{
    mode: string;
    accentColor: string;
    dashboardDensity: string;
    sidebarDefaultState: string;
  }>("/settings/appearance");
  useEffect(() => {
    if (!appearance) return;
    document.documentElement.classList.toggle("light", appearance.mode === "Light");
    if (appearance.accentColor) {
      document.documentElement.style.setProperty("--color-accent", appearance.accentColor);
    }
    document.documentElement.classList.toggle("compact", appearance.dashboardDensity === "Compact");

    // Only set the sidebar's collapsed state from the saved default once,
    // the first time settings load \u2014 otherwise every background refetch
    // of /settings/appearance would stomp on the user manually toggling the
    // sidebar open/closed during the session.
    if (!sidebarDefaultApplied.current) {
      setCollapsed(appearance.sidebarDefaultState === "Collapsed");
      sidebarDefaultApplied.current = true;
    }
  }, [appearance]);

  function renderPage() {
    switch (active) {
      case "dashboard":
      case "live-forecourt":
        return <DashboardPage onNavigate={setActive} />;
      case "sales":
        return <Sales />;
      case "pos":
        return <POS />;
      case "dispensers":
        return <Dispensers />;
      case "nozzles":
        return <Nozzles />;
      case "fuel-tanks":
        return <FuelTanks />;
      case "tank-gauges":
        return <TankGauges onNavigate={setActive} />;
      case "controllers":
        return <Controllers />;
      case "cash-management":
        return <CashManagement />;
      case "reports":
        return <Reports />;
      case "analytics":
        return <Analytics />;
      case "administration":
        return <Administration onNavigate={setActive} />;
      case "shifts":
        return <Shifts />;
      case "crm":
        return <CRM />;
      case "deliveries":
        return <Deliveries />;
      case "fleet-accounts":
        return <FleetAccounts />;
      case "inventory":
        return <Inventory />;
      case "loyalty":
        return <Loyalty />;
      case "maintenance":
        return <Maintenance />;
      case "price-management":
        return <PriceManagement />;
      case "settings":
        return <Settings onNavigate={setActive} />;
      case "users":
        return <Users />;
      case "system-health":
        return <SystemHealth />;
      case "audit-logs":
        return <AuditLogs />;
      case "alerts":
        return <Alerts />;
      case "finance":
        return <Finance />;
      default:
        return <PlaceholderPage title={PAGE_LABEL[active] ?? active} />;
    }
  }

  return (
    <div className="h-screen w-full flex bg-bg overflow-hidden">
      <Sidebar
        active={active}
        onSelect={setActive}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} onNavigate={setActive} />

        <main className="flex-1 min-h-0 overflow-y-auto" style={{ padding: "var(--content-padding)" }}>{renderPage()}</main>

        <StatusFooter />
      </div>
    </div>
  );
}

export default function App() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-bg">
        <Loader2 size={22} className="animate-spin text-accent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Login />;
  }

  return <AppShell />;
}