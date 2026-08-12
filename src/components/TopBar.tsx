import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Cpu,
  GaugeCircle,
  Wifi,
  ShieldCheck,
  Bell,
  ChevronDown,
  LogOut,
  Check,
  Plus,
  Maximize,
  Minimize,
  Menu,
  CheckCircle2,
  X,
} from "lucide-react";
import { clockNow, dateNow } from "../lib/format";
import { useAuth } from "../lib/AuthContext";
import { useApiData } from "../lib/useApiData";
import { usePumpTelemetry } from "../lib/usePumpTelemetry";
import Modal, { FormField, inputClass, ModalActions } from "./ui/Modal";
import StationSetupWizard from "./StationSetupWizard";
import { api, ApiError } from "../lib/api";
import type { AlertRow } from "../types";

interface Station {
  id: number;
  code: string;
  name: string;
}

function StatusChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "success" | "info" | "warning" | "danger";
}) {
  const dot =
    tone === "success"
      ? "bg-[var(--color-success)]"
      : tone === "info"
      ? "bg-[var(--color-info)]"
      : tone === "warning"
      ? "bg-[var(--color-warning)]"
      : "bg-[var(--color-danger)]";
  return (
    <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] border border-[var(--color-border)]">
      <Icon size={14} className="text-[var(--color-text-dim)]" />
      <div className="leading-none">
        <div className="text-[10px] text-[var(--color-text-faint)]">{label}</div>
        <div className="text-[12px] font-medium flex items-center gap-1.5 mt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {value}
        </div>
      </div>
    </div>
  );
}

export default function TopBar({
  onOpenMobileMenu,
  onNavigate,
}: {
  onOpenMobileMenu: () => void;
  onNavigate: (route: string) => void;
}) {
  const [time, setTime] = useState(clockNow());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Some browsers/contexts (e.g. an iframe without allow="fullscreen")
      // reject this silently \u2014 nothing useful to do beyond not crashing.
    }
  }

  const { user, logout, switchStation } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stationMenuOpen, setStationMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const stationMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: alertsData, refetch: refetchAlerts } = useApiData<AlertRow[]>("/alerts", []);
  const activeAlertsList = (alertsData ?? []).filter((a) => a.status === "Active").slice(0, 6);

  async function acknowledgeAlert(id: string) {
    try {
      await api.patch(`/alerts/${id}`, { status: "Acknowledged" });
      refetchAlerts();
    } catch {
      /* silently ignore - the dropdown just won't update this one */
    }
  }
  const { data: stationsData, refetch: refetchStations } = useApiData<Station[]>("/stations", []);
  const stations = stationsData ?? [];
  const currentStation = stations.find((s) => s.id === user?.stationId);
  const canSwitchStations = user?.role === "Administrator";
  const [showNewStation, setShowNewStation] = useState(false);
  const [newlyCreatedStation, setNewlyCreatedStation] = useState<{ id: number; name: string } | null>(null);

  const { data: controllers } = useApiData<{ status: string }[]>("/controllers", []);
  const { data: tanks } = useApiData<{ atgOnline: boolean }[]>("/tanks", []);
  const { data: kpis } = useApiData<{ activeAlerts: number }>("/dashboard/kpis");
  const { data: health } = useApiData<{ services: { name: string; status: string }[] }>("/system-health");
  const { status: wsStatus } = usePumpTelemetry(true);

  const controllersDown = (controllers ?? []).filter((c) => c.status !== "online").length;
  const tanksOffline = (tanks ?? []).filter((t) => !t.atgOnline).length;
  const dbHealthy = health?.services.find((s) => s.name === "PostgreSQL")?.status !== "Down";
  const activeAlerts = kpis?.activeAlerts ?? 0;

  const networkChip =
    wsStatus === "connected"
      ? { value: "Excellent", tone: "success" as const }
      : wsStatus === "connecting"
      ? { value: "Connecting", tone: "info" as const }
      : { value: "Offline", tone: "danger" as const };

  useEffect(() => {
    const t = setInterval(() => setTime(clockNow()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (stationMenuRef.current && !stationMenuRef.current.contains(e.target as Node)) setStationMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSwitch(stationId: number) {
    if (stationId === user?.stationId) {
      setStationMenuOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await switchStation(stationId);
    } catch {
      setSwitching(false);
      setStationMenuOpen(false);
      alert("Could not switch stations. Please try again.");
    }
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")
    : "?";

  return (
    <header className="h-16 shrink-0 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden w-9 h-9 shrink-0 rounded-[8px] border border-[var(--color-border)] grid place-items-center hover:border-[var(--color-border-strong)] transition-colors"
          aria-label="Open menu"
        >
          <Menu size={17} className="text-[var(--color-text-dim)]" />
        </button>
        <div className="relative" ref={stationMenuRef}>
          <button
            onClick={() => canSwitchStations && setStationMenuOpen((v) => !v)}
            disabled={!canSwitchStations || switching}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] border border-[var(--color-border)] transition-colors min-w-0 max-w-[150px] sm:max-w-none ${
              canSwitchStations ? "hover:border-[var(--color-border-strong)] cursor-pointer" : "cursor-default"
            }`}
          >
            <MapPin size={14} className="text-[var(--color-text-dim)] shrink-0" />
            <div className="text-left leading-none min-w-0">
              <div className="text-[12px] font-medium truncate">
                {switching ? "Switching\u2026" : currentStation?.name ?? "Loading station\u2026"}
              </div>
              <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5 truncate">
                Station ID: {currentStation?.code ?? "\u2014"}
              </div>
            </div>
            {canSwitchStations && (
              <ChevronDown size={13} className="text-[var(--color-text-faint)] ml-1" />
            )}
          </button>

          {canSwitchStations && stationMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-lg py-1.5 z-50">
              <div className="px-3 py-1.5 text-[10.5px] text-[var(--color-text-faint)] uppercase tracking-wide">
                Switch Station
              </div>
              {stations.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSwitch(s.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[12.5px] hover:bg-white/[0.04] transition-colors"
                >
                  <span className="text-left">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-[10px] text-[var(--color-text-faint)]">{s.code}</div>
                  </span>
                  {s.id === user?.stationId && <Check size={14} className="text-[var(--color-accent)]" />}
                </button>
              ))}
              <div className="border-t border-[var(--color-border)] mt-1 pt-1">
                <button
                  onClick={() => {
                    setStationMenuOpen(false);
                    setShowNewStation(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-[var(--color-accent)] hover:bg-white/[0.04] transition-colors"
                >
                  <Plus size={14} /> New Station
                </button>
              </div>
            </div>
          )}
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-[var(--color-success-soft)] text-[var(--color-success)] text-[11.5px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
          Shift: Morning
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <div className="hidden lg:flex items-center gap-2.5">
          <StatusChip
            icon={Cpu}
            label="Controller"
            value={!controllers || controllers.length === 0 ? "None" : controllersDown === 0 ? "Online" : `${controllersDown} Down`}
            tone={!controllers || controllers.length === 0 ? "warning" : controllersDown === 0 ? "success" : "danger"}
          />
          <StatusChip
            icon={GaugeCircle}
            label="Tanks"
            value={!tanks || tanks.length === 0 ? "None" : tanksOffline === 0 ? "Online" : `${tanksOffline} Offline`}
            tone={!tanks || tanks.length === 0 ? "warning" : tanksOffline === 0 ? "success" : "warning"}
          />
          <StatusChip icon={Wifi} label="Network" value={networkChip.value} tone={networkChip.tone} />
          <StatusChip
            icon={ShieldCheck}
            label="System"
            value={dbHealthy ? "Healthy" : "Down"}
            tone={dbHealthy ? "success" : "danger"}
          />
        </div>

        <div className="hidden xl:block text-right leading-none px-1">
          <div className="text-[13px] font-mono-num">{time}</div>
          <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">{dateNow()}</div>
        </div>

        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit full screen" : "Enter full screen"}
          className="w-9 h-9 rounded-[8px] border border-[var(--color-border)] grid place-items-center hover:border-[var(--color-border-strong)] transition-colors"
        >
          {isFullscreen ? (
            <Minimize size={15} className="text-[var(--color-text-dim)]" />
          ) : (
            <Maximize size={15} className="text-[var(--color-text-dim)]" />
          )}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative w-9 h-9 rounded-[8px] border border-[var(--color-border)] grid place-items-center hover:border-[var(--color-border-strong)] transition-colors"
          >
            <Bell size={16} className="text-[var(--color-text-dim)]" />
            {activeAlerts > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-danger)] text-[9px] font-semibold grid place-items-center">
                {activeAlerts > 99 ? "99+" : activeAlerts}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-[320px] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--color-border)]">
                <h3 className="text-[12.5px] font-semibold">Notifications</h3>
                <span className="text-[10.5px] text-[var(--color-text-faint)]">{activeAlerts} active</span>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {activeAlertsList.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 py-8 text-[var(--color-text-faint)]">
                    <CheckCircle2 size={20} />
                    <span className="text-[12px]">You're all caught up.</span>
                  </div>
                ) : (
                  activeAlertsList.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-2.5 px-3.5 py-2.5 border-b border-[var(--color-border)] last:border-0 hover:bg-white/[0.02]"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                          a.severity === "danger"
                            ? "bg-[var(--color-danger)]"
                            : a.severity === "warning"
                            ? "bg-[var(--color-warning)]"
                            : "bg-[var(--color-info)]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] leading-snug">{a.message}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--color-text-faint)]">
                          <span>{a.module}</span>
                          <span>&middot;</span>
                          <span>{a.time}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => acknowledgeAlert(a.id)}
                        title="Acknowledge"
                        className="shrink-0 w-6 h-6 rounded-md grid place-items-center text-[var(--color-text-faint)] hover:text-[var(--color-success)] hover:bg-white/5 transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => {
                  setNotifOpen(false);
                  onNavigate("alerts");
                }}
                className="w-full py-2.5 text-[11.5px] text-[var(--color-accent)] hover:underline border-t border-[var(--color-border)]"
              >
                View All Alerts
              </button>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[8px] hover:bg-white/[0.04] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[#c97e14] grid place-items-center text-[12px] font-semibold text-[#081018]">
              {initials}
            </div>
            <div className="hidden lg:block text-left leading-none">
              <div className="text-[12px] font-medium">{user?.name ?? "Guest"}</div>
              <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5">{user?.role ?? ""}</div>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-lg py-1.5 z-50">
              <div className="px-3 py-2 border-b border-[var(--color-border)]">
                <div className="text-[12px] font-medium truncate">{user?.name}</div>
                <div className="text-[10.5px] text-[var(--color-text-faint)] truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-danger)] hover:bg-white/[0.04] transition-colors"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {showNewStation && (
        <NewStationModal
          onClose={() => setShowNewStation(false)}
          onCreated={async (stationId, name) => {
            setShowNewStation(false);
            refetchStations();
            setSwitching(true);
            try {
              // Don't reload yet \u2014 stay on this render so the wizard can
              // run immediately in the new station's context, then reload
              // once setup is actually finished.
              await switchStation(stationId, { reload: false });
              setSwitching(false);
              setNewlyCreatedStation({ id: stationId, name });
            } catch {
              setSwitching(false);
            }
          }}
        />
      )}

      {newlyCreatedStation && (
        <StationSetupWizard
          stationName={newlyCreatedStation.name}
          onFinish={() => {
            setNewlyCreatedStation(null);
            window.location.reload();
          }}
        />
      )}
    </header>
  );
}

function NewStationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (stationId: number, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const station = await api.post<{ id: number; code: string; name: string }>("/stations", { name });
      onCreated(station.id, station.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the station.");
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Station" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="text-[12px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <FormField label="Station Name">
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Westlands Service Station"
            className={inputClass}
          />
        </FormField>
        <p className="text-[11px] text-text-faint">
          The station code (e.g. STN-006) is assigned automatically. You'll be switched into it right away and
          guided through setting up prices, pumps, and tanks.
        </p>
        <ModalActions onCancel={onClose} submitLabel="Create Station" submitting={submitting} />
      </form>
    </Modal>
  );
}