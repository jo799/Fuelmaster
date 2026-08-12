import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Briefcase,
  Fuel,
  Monitor,
  Sliders,
  Ruler,
  ShieldCheck,
  Bell,
  Info,
  ChevronDown,
  Cpu,
  Radio,
  Plug,
  Landmark,
  MessageSquareText,
  Mail,
  Smartphone,
  Send,
  Lock,
  KeyRound,
  DatabaseBackup,
  Download,
  Upload,
  Palette,
  Type,
  LayoutGrid,
  Loader2,
  Check,
} from "lucide-react";
import { PageHeader, StatusPill } from "../components/ui/primitives";
import { useApiData } from "../lib/useApiData";
import { api, ApiError, getAccessToken, API_URL } from "../lib/api";
import { exportToCsv } from "../lib/exportCsv";
import { getPushStatus, enablePush, disablePush } from "../lib/push";
import Modal, { FormField, inputClass } from "../components/ui/Modal";

const TABS = ["General", "Fuel & Pricing", "Devices", "Integrations", "Notifications", "Security", "Backup & Data", "Appearance"];

interface GeneralSettings {
  stationName: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  language: string;
  businessType: string;
  fiscalYearStart: string;
  financialPeriod: string;
  taxRate: number;
  roundOff: string;
  fuelPriceManagementEnabled: boolean;
  allowPriceOverrides: boolean;
  lowStockAlertPct: number;
  autoFuelReorder: boolean;
  fuelReorderThresholdL: number;
  defaultFuelType: string;
  autoSync: boolean;
  offlineMode: boolean;
  systemLogs: boolean;
  dataBackup: boolean;
  userActivityLogging: boolean;
  maintenanceReminders: boolean;
  dashboardLayout: string;
  defaultDateRange: string;
  itemsPerPage: number;
  volumeUnit: string;
  temperatureUnit: string;
  pressureUnit: string;
  distanceUnit: string;
}
interface FuelPricingSettings {
  priceRounding: string;
  minMarginThresholdPct: number;
  requireApprovalForPriceChanges: boolean;
  regionalPricing: boolean;
  priceEffectiveDelay: string;
  scheduledUpdatesEnabled: boolean;
  updateTime: string;
  priceSource: string;
  notifyCashiersOnPriceChange: boolean;
  lowMarginAlerts: boolean;
  marginAlertThresholdPct: number;
  competitorPriceTracking: boolean;
  autoSuggestPriceAdjustments: boolean;
}
interface DevicesSettings {
  controllerPollingIntervalMs: number;
  controllerCommandTimeoutMs: number;
  autoReconnectOnFailure: boolean;
  failoverToBackupController: boolean;
  atgPollingIntervalSec: number;
  waterAlarmThresholdCm: number;
  autoSyncVolumeReadings: boolean;
  temperatureCompensation: boolean;
}
interface IntegrationState {
  connected: boolean;
  label: string;
}
interface NotificationSettings {
  lowFuelAlerts: boolean;
  maintenanceReminders: boolean;
  tankLevelAlerts: boolean;
  systemUpdates: boolean;
  salesRevenueAlerts: boolean;
  securityAlerts: boolean;
  fleetAccountOverLimit: boolean;
  deliveryStatusChanges: boolean;
  channelInApp: boolean;
  channelEmail: boolean;
  channelSms: boolean;
  channelPush: boolean;
  digestFrequency: string;
}
interface SecuritySettings {
  passwordPolicy: string;
  sessionTimeoutMinutes: number;
  twoFactorEnabled: boolean;
  requirePinForCriticalActions: boolean;
  maxLoginAttempts: number;
  apiAccessEnabled: boolean;
  apiRateLimit: number;
  ipAllowlistEnabled: boolean;
  deviceSessionTracking: boolean;
  fullAuditLogging: boolean;
  logRetentionMonths: number;
  alertOnSuspiciousActivity: boolean;
}
interface BackupSettings {
  automaticDailyBackup: boolean;
  backupTime: string;
  retentionDays: number;
  lastBackupAt: string | null;
}
interface AppearanceSettings {
  mode: string;
  accentColor: string;
  dashboardDensity: string;
  sidebarDefaultState: string;
  showKpiDeltas: boolean;
  baseFontSize: string;
  numberFormat: string;
  useMonospaceForFigures: boolean;
}
interface StationSettings {
  general: GeneralSettings;
  fuelPricing: FuelPricingSettings;
  devices: DevicesSettings;
  integrations: Record<string, IntegrationState>;
  notifications: NotificationSettings;
  security: SecuritySettings;
  backup: BackupSettings;
  appearance: AppearanceSettings;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${checked ? "bg-success" : "bg-white/10"}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12.5px] text-text-dim">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] text-text-faint mb-1">{label}</div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white/3 border border-border rounded-lg px-3 py-2 text-[12.5px] hover:border-border-strong transition-colors focus:outline-none focus:border-accent"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown size={13} className="text-text-faint absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="text-[11px] text-text-faint mb-1">
        {label} {suffix && <span className="text-text-faint">({suffix})</span>}
      </div>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputClass} />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[11px] text-text-faint mb-1">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3.5">
        <Icon size={15} className="text-text-dim" />
        <h3 className="text-[13px] font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function GeneralTab({
  settings,
  update,
  onNavigate,
}: {
  settings: GeneralSettings;
  update: (patch: Partial<GeneralSettings>) => void;
  onNavigate: (route: string) => void;
}) {
  const { data: health } = useApiData<{ uptimeSeconds: number }>("/system-health");
  const uptimeLabel = (() => {
    const s = health?.uptimeSeconds ?? 0;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h` : `${h}h`;
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="space-y-4">
        <SettingsCard icon={SettingsIcon} title="General Settings">
          <TextField label="Station Name" value={settings.stationName} onChange={(v) => update({ stationName: v })} />
          <SelectField
            label="Time Zone"
            value={settings.timezone}
            options={["Africa/Nairobi", "Africa/Lagos", "Africa/Cairo", "UTC"]}
            onChange={(v) => update({ timezone: v })}
          />
          <SelectField
            label="Currency"
            value={settings.currency}
            options={["KES (KSh)", "USD ($)", "EUR (\u20ac)", "TZS (TSh)", "UGX (USh)"]}
            onChange={(v) => update({ currency: v })}
          />
          <SelectField
            label="Date Format"
            value={settings.dateFormat}
            options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]}
            onChange={(v) => update({ dateFormat: v })}
          />
          <SelectField
            label="Time Format"
            value={settings.timeFormat}
            options={["12 Hour", "24 Hour"]}
            onChange={(v) => update({ timeFormat: v })}
          />
          <SelectField
            label="Language"
            value={settings.language}
            options={["English", "Swahili"]}
            onChange={(v) => update({ language: v })}
          />
        </SettingsCard>

        <SettingsCard icon={Briefcase} title="Business Settings">
          <SelectField
            label="Business Type"
            value={settings.businessType}
            options={["Fuel Station", "Fuel Station + Convenience Store", "Fleet Depot"]}
            onChange={(v) => update({ businessType: v })}
          />
          <SelectField
            label="Fiscal Year Start"
            value={settings.fiscalYearStart}
            options={["January", "April", "July", "October"]}
            onChange={(v) => update({ fiscalYearStart: v })}
          />
          <SelectField
            label="Financial Period"
            value={settings.financialPeriod}
            options={["Monthly", "Quarterly", "Annually"]}
            onChange={(v) => update({ financialPeriod: v })}
          />
          <NumberField label="Tax Rate" suffix="%" value={settings.taxRate} onChange={(v) => update({ taxRate: v })} />
          <SelectField
            label="Round Off"
            value={settings.roundOff}
            options={["No Rounding", "Nearest 0.01", "Nearest 0.10", "Nearest 1.00"]}
            onChange={(v) => update({ roundOff: v })}
          />
        </SettingsCard>

        <SettingsCard icon={Fuel} title="Fuel Management Settings">
          <ToggleRow
            label="Enable Fuel Price Management"
            checked={settings.fuelPriceManagementEnabled}
            onChange={(v) => update({ fuelPriceManagementEnabled: v })}
          />
          <ToggleRow
            label="Allow Price Overrides"
            checked={settings.allowPriceOverrides}
            onChange={(v) => update({ allowPriceOverrides: v })}
          />
          <NumberField
            label="Low Stock Alert"
            suffix="% of Capacity"
            value={settings.lowStockAlertPct}
            onChange={(v) => update({ lowStockAlertPct: v })}
          />
          <ToggleRow label="Auto Fuel Reorder" checked={settings.autoFuelReorder} onChange={(v) => update({ autoFuelReorder: v })} />
          <NumberField
            label="Fuel Reorder Threshold"
            suffix="L"
            value={settings.fuelReorderThresholdL}
            onChange={(v) => update({ fuelReorderThresholdL: v })}
          />
          <SelectField
            label="Default Fuel Type"
            value={settings.defaultFuelType}
            options={["Petrol (PMS 95)", "Diesel (ENS90)", "Kerosene"]}
            onChange={(v) => update({ defaultFuelType: v })}
          />
        </SettingsCard>
      </div>

      <div className="space-y-4">
        <SettingsCard icon={Sliders} title="System Settings">
          <ToggleRow label="Auto Sync" checked={settings.autoSync} onChange={(v) => update({ autoSync: v })} />
          <ToggleRow label="Offline Mode" checked={settings.offlineMode} onChange={(v) => update({ offlineMode: v })} />
          <ToggleRow label="System Logs" checked={settings.systemLogs} onChange={(v) => update({ systemLogs: v })} />
          <ToggleRow label="Data Backup" checked={settings.dataBackup} onChange={(v) => update({ dataBackup: v })} />
          <ToggleRow
            label="User Activity Logging"
            checked={settings.userActivityLogging}
            onChange={(v) => update({ userActivityLogging: v })}
          />
          <ToggleRow
            label="Maintenance Reminders"
            checked={settings.maintenanceReminders}
            onChange={(v) => update({ maintenanceReminders: v })}
          />
        </SettingsCard>

        <SettingsCard icon={Monitor} title="Display Settings">
          <SelectField
            label="Dashboard Layout"
            value={settings.dashboardLayout}
            options={["Standard", "Compact", "Detailed"]}
            onChange={(v) => update({ dashboardLayout: v })}
          />
          <SelectField
            label="Default Date Range"
            value={settings.defaultDateRange}
            options={["Today", "Last 7 Days", "Last 30 Days", "This Month"]}
            onChange={(v) => update({ defaultDateRange: v })}
          />
          <SelectField
            label="Items Per Page"
            value={String(settings.itemsPerPage)}
            options={["10", "25", "50", "100"]}
            onChange={(v) => update({ itemsPerPage: Number(v) })}
          />
        </SettingsCard>

        <SettingsCard icon={Ruler} title="Units & Measurements">
          <SelectField
            label="Volume Unit"
            value={settings.volumeUnit}
            options={["Liters (L)", "Gallons (gal)"]}
            onChange={(v) => update({ volumeUnit: v })}
          />
          <SelectField
            label="Temperature Unit"
            value={settings.temperatureUnit}
            options={["Celsius (\u00b0C)", "Fahrenheit (\u00b0F)"]}
            onChange={(v) => update({ temperatureUnit: v })}
          />
          <SelectField
            label="Pressure Unit"
            value={settings.pressureUnit}
            options={["Bar", "PSI", "kPa"]}
            onChange={(v) => update({ pressureUnit: v })}
          />
          <SelectField
            label="Distance Unit"
            value={settings.distanceUnit}
            options={["Kilometers (km)", "Miles (mi)"]}
            onChange={(v) => update({ distanceUnit: v })}
          />
        </SettingsCard>
      </div>

      <div className="space-y-4">
        <SettingsCard icon={Info} title="System Information">
          <div className="space-y-2 text-[12px]">
            {[
              ["System Version", "v2.5.0"],
              ["Backend Uptime", uptimeLabel],
            ].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between">
                <span className="text-text-faint">{l}</span>
                <span className="font-mono-num">{v}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate("audit-logs")}
            className="w-full mt-1 py-2 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong transition-colors"
          >
            View System Logs
          </button>
        </SettingsCard>
      </div>
    </div>
  );
}

function FuelPricingTab({
  settings,
  update,
}: {
  settings: FuelPricingSettings;
  update: (patch: Partial<FuelPricingSettings>) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SettingsCard icon={Fuel} title="Pricing Rules">
        <SelectField
          label="Price Rounding"
          value={settings.priceRounding}
          options={["No Rounding", "Nearest 0.10", "Nearest 1.00"]}
          onChange={(v) => update({ priceRounding: v })}
        />
        <NumberField
          label="Minimum Margin Threshold"
          suffix="%"
          value={settings.minMarginThresholdPct}
          onChange={(v) => update({ minMarginThresholdPct: v })}
        />
        <ToggleRow
          label="Require Approval for Price Changes"
          checked={settings.requireApprovalForPriceChanges}
          onChange={(v) => update({ requireApprovalForPriceChanges: v })}
        />
        <ToggleRow label="Regional Pricing" checked={settings.regionalPricing} onChange={(v) => update({ regionalPricing: v })} />
        <SelectField
          label="Default Price Effective Delay"
          value={settings.priceEffectiveDelay}
          options={["Immediate", "Next Business Day", "Scheduled"]}
          onChange={(v) => update({ priceEffectiveDelay: v })}
        />
      </SettingsCard>

      <SettingsCard icon={Landmark} title="Scheduled Updates">
        <ToggleRow
          label="Enable Scheduled Price Updates"
          checked={settings.scheduledUpdatesEnabled}
          onChange={(v) => update({ scheduledUpdatesEnabled: v })}
        />
        <TextField label="Update Time" value={settings.updateTime} onChange={(v) => update({ updateTime: v })} />
        <SelectField
          label="Price Source"
          value={settings.priceSource}
          options={["Manual Entry", "Regulator Feed", "Head Office Feed"]}
          onChange={(v) => update({ priceSource: v })}
        />
        <ToggleRow
          label="Notify Cashiers on Price Change"
          checked={settings.notifyCashiersOnPriceChange}
          onChange={(v) => update({ notifyCashiersOnPriceChange: v })}
        />
      </SettingsCard>

      <SettingsCard icon={ShieldCheck} title="Margin Alerts">
        <ToggleRow label="Low Margin Alerts" checked={settings.lowMarginAlerts} onChange={(v) => update({ lowMarginAlerts: v })} />
        <NumberField
          label="Alert Threshold"
          suffix="%"
          value={settings.marginAlertThresholdPct}
          onChange={(v) => update({ marginAlertThresholdPct: v })}
        />
        <ToggleRow
          label="Competitor Price Tracking"
          checked={settings.competitorPriceTracking}
          onChange={(v) => update({ competitorPriceTracking: v })}
        />
        <ToggleRow
          label="Auto-Suggest Price Adjustments"
          checked={settings.autoSuggestPriceAdjustments}
          onChange={(v) => update({ autoSuggestPriceAdjustments: v })}
        />
      </SettingsCard>
    </div>
  );
}

interface ControllerRow {
  id: string;
  model: string;
  status: string;
}
interface TankRow {
  id: string;
  product: string;
  atgOnline: boolean;
}

function DevicesTab({
  settings,
  update,
  onNavigate,
}: {
  settings: DevicesSettings;
  update: (patch: Partial<DevicesSettings>) => void;
  onNavigate: (route: string) => void;
}) {
  const { data: controllers } = useApiData<ControllerRow[]>("/controllers", []);
  const { data: tanks } = useApiData<TankRow[]>("/tanks", []);

  const devices = [
    ...(controllers ?? []).map((c) => ({
      name: c.id,
      type: `Forecourt Controller (${c.model})`,
      online: c.status === "online",
    })),
    ...(tanks ?? []).map((t) => ({
      name: `${t.id} ATG`,
      type: `Tank Gauge (${t.product})`,
      online: t.atgOnline,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SettingsCard icon={Cpu} title="Controller Defaults">
          <NumberField
            label="Polling Interval"
            suffix="ms"
            value={settings.controllerPollingIntervalMs}
            onChange={(v) => update({ controllerPollingIntervalMs: v })}
          />
          <NumberField
            label="Command Timeout"
            suffix="ms"
            value={settings.controllerCommandTimeoutMs}
            onChange={(v) => update({ controllerCommandTimeoutMs: v })}
          />
          <ToggleRow
            label="Auto-Reconnect on Failure"
            checked={settings.autoReconnectOnFailure}
            onChange={(v) => update({ autoReconnectOnFailure: v })}
          />
          <ToggleRow
            label="Failover to Backup Controller"
            checked={settings.failoverToBackupController}
            onChange={(v) => update({ failoverToBackupController: v })}
          />
        </SettingsCard>

        <SettingsCard icon={Radio} title="Tank Gauge Defaults">
          <NumberField
            label="ATG Polling Interval"
            suffix="s"
            value={settings.atgPollingIntervalSec}
            onChange={(v) => update({ atgPollingIntervalSec: v })}
          />
          <NumberField
            label="Water Alarm Threshold"
            suffix="cm"
            value={settings.waterAlarmThresholdCm}
            onChange={(v) => update({ waterAlarmThresholdCm: v })}
          />
          <ToggleRow
            label="Auto-Sync Volume Readings"
            checked={settings.autoSyncVolumeReadings}
            onChange={(v) => update({ autoSyncVolumeReadings: v })}
          />
          <ToggleRow
            label="Temperature Compensation"
            checked={settings.temperatureCompensation}
            onChange={(v) => update({ temperatureCompensation: v })}
          />
        </SettingsCard>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-[13px] font-semibold">Connected Devices</h3>
          <button onClick={() => onNavigate("controllers")} className="text-[11.5px] text-accent hover:underline">
            Add Device
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Device</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.name} className="border-t border-border hover:bg-white/2">
                  <td className="px-4 py-2.5 font-medium">{d.name}</td>
                  <td className="px-4 py-2.5 text-text-dim">{d.type}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={d.online ? "success" : "danger"} label={d.online ? "Online" : "Offline"} />
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-text-faint">
                    No controllers or tank gauges registered at this station yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const INTEGRATION_META: { id: string; icon: React.ElementType; name: string; desc: string }[] = [
  { id: "kra-etims", icon: Landmark, name: "KRA eTIMS", desc: "Electronic tax invoicing (OSCU/VSCU)" },
  { id: "mpesa-daraja", icon: Smartphone, name: "M-Pesa Daraja", desc: "Mobile money payments" },
  { id: "sms-gateway", icon: MessageSquareText, name: "SMS Gateway", desc: "Customer and staff SMS alerts" },
  { id: "email-provider", icon: Mail, name: "Email Provider", desc: "Receipts and report delivery" },
  { id: "accounting-export", icon: Send, name: "Accounting Export", desc: "QuickBooks / Sage sync" },
];

function IntegrationsTab({
  integrations,
  update,
}: {
  integrations: Record<string, IntegrationState>;
  update: (id: string, state: IntegrationState) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {INTEGRATION_META.map((i) => {
        const state = integrations[i.id] ?? { connected: false, label: "" };
        return (
          <div key={i.id} className="card p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-white/5 grid place-items-center text-text-dim shrink-0">
              <i.icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{i.name}</div>
              <div className="text-[11px] text-text-faint truncate">{state.connected && state.label ? state.label : i.desc}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusPill tone={state.connected ? "success" : "neutral"} label={state.connected ? "Connected" : "Not Connected"} />
              <button
                onClick={() => setEditing(i.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium ${
                  state.connected ? "border border-border text-text-dim" : "bg-accent text-bg"
                }`}
              >
                {state.connected ? (
                  "Manage"
                ) : (
                  <span className="flex items-center gap-1">
                    <Plug size={12} /> Connect
                  </span>
                )}
              </button>
            </div>
          </div>
        );
      })}

      {editing && (
        <IntegrationModal
          meta={INTEGRATION_META.find((i) => i.id === editing)!}
          state={integrations[editing] ?? { connected: false, label: "" }}
          onClose={() => setEditing(null)}
          onSave={(state) => {
            update(editing, state);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function IntegrationModal({
  meta,
  state,
  onClose,
  onSave,
}: {
  meta: { name: string; desc: string };
  state: IntegrationState;
  onClose: () => void;
  onSave: (state: IntegrationState) => void;
}) {
  const [label, setLabel] = useState(state.label);

  return (
    <Modal title={meta.name} onClose={onClose}>
      <div className="space-y-3.5">
        <p className="text-[12px] text-text-dim">{meta.desc}</p>
        <FormField label="API Key / Credential Label">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Production key, or a short label"
            className={inputClass}
          />
        </FormField>
        <p className="text-[11px] text-text-faint">
          This stores a label against the integration so the platform reflects it as connected \u2014 it doesn't perform
          a live OAuth/API handshake with {meta.name} itself.
        </p>
        <div className="flex items-center justify-between gap-2.5 mt-1">
          {state.connected ? (
            <button
              type="button"
              onClick={() => onSave({ connected: false, label: "" })}
              className="px-3.5 py-2 rounded-lg border border-danger/30 text-[12.5px] text-danger"
            >
              Disconnect
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-border text-[12.5px] text-text-dim">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ connected: true, label })}
              disabled={!label.trim()}
              className="px-3.5 py-2 rounded-lg bg-accent text-bg text-[12.5px] font-medium disabled:opacity-50"
            >
              Save &amp; Connect
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface TestNotificationResult {
  inApp: true;
  email: { attempted: boolean; ok: boolean; error?: string };
  sms: { attempted: boolean; ok: boolean; error?: string };
  push: { attempted: boolean; ok: boolean; error?: string };
}

function NotificationsTab({
  settings,
  update,
}: {
  settings: NotificationSettings;
  update: (patch: Partial<NotificationSettings>) => void;
}) {
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<TestNotificationResult | null>(null);

  useEffect(() => {
    getPushStatus().then(setPushSubscribed);
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      if (pushSubscribed) {
        await disablePush();
        setPushSubscribed(false);
      } else {
        await enablePush();
        setPushSubscribed(true);
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Could not update push subscription.");
    } finally {
      setPushBusy(false);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const result = await api.post<TestNotificationResult>("/notifications/test");
      setTestResult(result);
    } catch {
      setTestResult(null);
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SettingsCard icon={Bell} title="Alert Types">
        <ToggleRow label="Low Fuel Alerts" checked={settings.lowFuelAlerts} onChange={(v) => update({ lowFuelAlerts: v })} />
        <ToggleRow
          label="Maintenance Reminders"
          checked={settings.maintenanceReminders}
          onChange={(v) => update({ maintenanceReminders: v })}
        />
        <ToggleRow label="Tank Level Alerts" checked={settings.tankLevelAlerts} onChange={(v) => update({ tankLevelAlerts: v })} />
        <ToggleRow label="System Updates" checked={settings.systemUpdates} onChange={(v) => update({ systemUpdates: v })} />
        <ToggleRow
          label="Sales & Revenue Alerts"
          checked={settings.salesRevenueAlerts}
          onChange={(v) => update({ salesRevenueAlerts: v })}
        />
        <ToggleRow label="Security Alerts" checked={settings.securityAlerts} onChange={(v) => update({ securityAlerts: v })} />
        <ToggleRow
          label="Fleet Account Over-Limit"
          checked={settings.fleetAccountOverLimit}
          onChange={(v) => update({ fleetAccountOverLimit: v })}
        />
        <ToggleRow
          label="Delivery Status Changes"
          checked={settings.deliveryStatusChanges}
          onChange={(v) => update({ deliveryStatusChanges: v })}
        />
      </SettingsCard>

      <SettingsCard icon={Mail} title="Delivery Channels">
        <div className="space-y-2.5">
          {(
            [
              { icon: Bell, label: "In-App", key: "channelInApp" as const },
              { icon: Mail, label: "Email", key: "channelEmail" as const },
              { icon: Smartphone, label: "SMS", key: "channelSms" as const },
              { icon: Send, label: "Push Notifications", key: "channelPush" as const },
            ]
          ).map((c) => (
            <div key={c.label} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-2 text-[12.5px] text-text-dim">
                <c.icon size={14} className="text-text-faint" />
                {c.label}
              </span>
              <Toggle checked={settings[c.key]} onChange={(v) => update({ [c.key]: v })} />
            </div>
          ))}
        </div>
        <SelectField
          label="Digest Frequency"
          value={settings.digestFrequency}
          options={["Real-time", "Hourly", "Daily", "Weekly"]}
          onChange={(v) => update({ digestFrequency: v })}
        />
        <div className="pt-1 border-t border-border">
          <p className="text-[10.5px] text-text-faint mb-2 pt-2.5">
            The Push Notifications toggle above controls whether this station sends pushes at all. This button
            controls whether <em>this specific browser</em> is actually subscribed to receive them.
          </p>
          {pushError && (
            <div className="text-[11.5px] text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2 mb-2">
              {pushError}
            </div>
          )}
          <button
            onClick={togglePush}
            disabled={pushBusy || pushSubscribed === null}
            className={`w-full py-2 rounded-lg text-[12px] font-medium disabled:opacity-60 ${
              pushSubscribed ? "border border-danger/30 text-danger" : "bg-accent text-bg"
            }`}
          >
            {pushBusy
              ? "Working\u2026"
              : pushSubscribed === null
              ? "Checking\u2026"
              : pushSubscribed
              ? "Disable Push on This Device"
              : "Enable Push on This Device"}
          </button>
        </div>

        <div className="pt-3 border-t border-border mt-3">
          <button
            onClick={sendTest}
            disabled={testBusy}
            className="w-full py-2 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong transition-colors disabled:opacity-60"
          >
            {testBusy ? "Sending test\u2026" : "Send Test Notification"}
          </button>
          {testResult && (
            <div className="mt-2.5 space-y-1.5 text-[11.5px]">
              <TestResultRow label="In-App Alert" ok={true} note="Check the Alerts page" />
              <TestResultRow
                label="Email"
                ok={testResult.email.ok}
                note={testResult.email.ok ? `Sent \u2014 check your inbox` : testResult.email.error}
              />
              <TestResultRow
                label="SMS"
                ok={testResult.sms.attempted ? testResult.sms.ok : null}
                note={
                  !testResult.sms.attempted
                    ? "No phone number on your account \u2014 add one in Users"
                    : testResult.sms.ok
                    ? "Sent \u2014 check your phone"
                    : testResult.sms.error
                }
              />
              <TestResultRow
                label="Push"
                ok={testResult.push.ok}
                note={testResult.push.ok ? "Sent \u2014 check for a system notification" : testResult.push.error}
              />
            </div>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}

function TestResultRow({ label, ok, note }: { label: string; ok: boolean | null; note?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
          ok === true ? "bg-success" : ok === false ? "bg-danger" : "bg-text-faint"
        }`}
      />
      <div className="min-w-0">
        <span className="font-medium">{label}</span>
        {note && <span className="text-text-faint"> \u2014 {note}</span>}
      </div>
    </div>
  );
}

function SecurityTab({ settings, update }: { settings: SecuritySettings; update: (patch: Partial<SecuritySettings>) => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SettingsCard icon={Lock} title="Authentication">
        <SelectField
          label="Password Policy"
          value={settings.passwordPolicy}
          options={["Basic", "Strong", "Very Strong"]}
          onChange={(v) => update({ passwordPolicy: v })}
        />
        <NumberField
          label="Session Timeout"
          suffix="minutes"
          value={settings.sessionTimeoutMinutes}
          onChange={(v) => update({ sessionTimeoutMinutes: v })}
        />
        <ToggleRow
          label="Two-Factor Authentication"
          checked={settings.twoFactorEnabled}
          onChange={(v) => update({ twoFactorEnabled: v })}
        />
        <ToggleRow
          label="Require PIN for Critical Actions"
          checked={settings.requirePinForCriticalActions}
          onChange={(v) => update({ requirePinForCriticalActions: v })}
        />
        <NumberField
          label="Maximum Login Attempts"
          value={settings.maxLoginAttempts}
          onChange={(v) => update({ maxLoginAttempts: v })}
        />
      </SettingsCard>

      <SettingsCard icon={KeyRound} title="API & Access">
        <ToggleRow label="API Access Enabled" checked={settings.apiAccessEnabled} onChange={(v) => update({ apiAccessEnabled: v })} />
        <NumberField
          label="API Rate Limit"
          suffix="req/min"
          value={settings.apiRateLimit}
          onChange={(v) => update({ apiRateLimit: v })}
        />
        <ToggleRow label="IP Allowlist" checked={settings.ipAllowlistEnabled} onChange={(v) => update({ ipAllowlistEnabled: v })} />
        <ToggleRow
          label="Device Session Tracking"
          checked={settings.deviceSessionTracking}
          onChange={(v) => update({ deviceSessionTracking: v })}
        />
      </SettingsCard>

      <SettingsCard icon={ShieldCheck} title="Audit & Compliance">
        <ToggleRow label="Full Audit Logging" checked={settings.fullAuditLogging} onChange={(v) => update({ fullAuditLogging: v })} />
        <SelectField
          label="Log Retention Period"
          value={`${settings.logRetentionMonths} Months`}
          options={["3 Months", "6 Months", "12 Months", "24 Months"]}
          onChange={(v) => update({ logRetentionMonths: Number(v.split(" ")[0]) })}
        />
        <ToggleRow
          label="Alert on Suspicious Activity"
          checked={settings.alertOnSuspiciousActivity}
          onChange={(v) => update({ alertOnSuspiciousActivity: v })}
        />
      </SettingsCard>

      <div className="lg:col-span-3 text-[11px] text-text-faint">
        Two-Factor Authentication, IP Allowlist, and API Rate Limit are saved here but not yet enforced by the
        login/API layer \u2014 the values persist correctly, actual enforcement is a follow-up.
      </div>
    </div>
  );
}

function nextOccurrence(timeLabel: string): string {
  const match = timeLabel.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "\u2014";
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  const minute = Number(match[2]);
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  return next.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function BackupDataTab({
  settings,
  update,
  onBackupComplete,
}: {
  settings: BackupSettings;
  update: (patch: Partial<BackupSettings>) => void;
  onBackupComplete: () => void;
}) {
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showRestoreInfo, setShowRestoreInfo] = useState(false);

  async function runBackupNow() {
    setRunningBackup(true);
    setBackupError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/settings/backup`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Backup failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="(.+)"/);
      link.href = url;
      link.download = filenameMatch?.[1] ?? "fuelmaster-backup.sql";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onBackupComplete();
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Could not run the backup.");
    } finally {
      setRunningBackup(false);
    }
  }

  async function exportNow() {
    setExporting(true);
    try {
      const rows = await api.get<Record<string, unknown>[]>("/sales/transactions?limit=200");
      exportToCsv("fuelmaster-sales-export", rows);
    } catch {
      alert("Could not export data right now.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SettingsCard icon={DatabaseBackup} title="Backup Schedule">
        <ToggleRow
          label="Automatic Daily Backup"
          checked={settings.automaticDailyBackup}
          onChange={(v) => update({ automaticDailyBackup: v })}
        />
        <TextField label="Backup Time" value={settings.backupTime} onChange={(v) => update({ backupTime: v })} />
        <SelectField
          label="Retention Period"
          value={`${settings.retentionDays} Days`}
          options={["30 Days", "60 Days", "90 Days", "365 Days"]}
          onChange={(v) => update({ retentionDays: Number(v.split(" ")[0]) })}
        />
        {backupError && <p className="text-[11.5px] text-danger">{backupError}</p>}
        <button
          onClick={runBackupNow}
          disabled={runningBackup}
          className="w-full mt-1 py-2 rounded-lg bg-accent text-bg text-[12px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {runningBackup ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Running Backup&hellip;
            </>
          ) : (
            "Run Backup Now"
          )}
        </button>
        <p className="text-[10.5px] text-text-faint">
          Runs a real <code>pg_dump</code> and downloads it \u2014 this is a genuine, restorable database backup.
        </p>
      </SettingsCard>

      <SettingsCard icon={Download} title="Export Data">
        <p className="text-[11.5px] text-text-dim">Exports your most recent sales transactions as a CSV file.</p>
        <button
          onClick={exportNow}
          disabled={exporting}
          className="w-full mt-1 py-2 rounded-lg border border-border text-[12px] text-text-dim hover:border-border-strong transition-colors disabled:opacity-60"
        >
          {exporting ? "Exporting\u2026" : "Export Now"}
        </button>
      </SettingsCard>

      <SettingsCard icon={Upload} title="Restore">
        <p className="text-[12px] text-text-faint">
          Restoring from a backup will overwrite current data. This action requires administrator confirmation.
        </p>
        <button
          onClick={() => setShowRestoreInfo(true)}
          className="w-full mt-1 py-2 rounded-lg border border-danger/30 text-[12px] text-danger"
        >
          Restore from Backup
        </button>
      </SettingsCard>

      <div className="lg:col-span-3 card p-4">
        <h3 className="text-[13px] font-semibold mb-2">Backup Status</h3>
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-text-dim">Last Backup</span>
          <span className="font-mono-num">
            {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : "Never run yet"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12.5px] mt-1.5">
          <span className="text-text-dim">Next Scheduled Backup</span>
          <span className="font-mono-num">
            {settings.automaticDailyBackup ? nextOccurrence(settings.backupTime) : "Automatic backup disabled"}
          </span>
        </div>
      </div>

      {showRestoreInfo && (
        <Modal title="Restore from Backup" onClose={() => setShowRestoreInfo(false)}>
          <p className="text-[12.5px] text-text-dim mb-4">
            Restoring overwrites the live database and isn't something this UI performs as a one-click self-service
            action \u2014 the risk of a bad restore wiping real data is too high to automate without direct database
            administration. To restore a backup, an administrator should run:
          </p>
          <pre className="bg-white/5 border border-border rounded-lg p-3 text-[11px] font-mono-num overflow-x-auto mb-4">
            psql $DATABASE_URL &lt; fuelmaster-backup-&lt;date&gt;.sql
          </pre>
          <div className="flex justify-end">
            <button
              onClick={() => setShowRestoreInfo(false)}
              className="px-3.5 py-2 rounded-lg bg-accent text-bg text-[12.5px] font-medium"
            >
              Understood
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AppearanceTab({
  settings,
  update,
}: {
  settings: AppearanceSettings;
  update: (patch: Partial<AppearanceSettings>) => void;
}) {
  const accents = ["#f9a826", "#38bdf8", "#17c964", "#a78bfa", "#f31260"];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SettingsCard icon={Palette} title="Theme">
        <SelectField
          label="Mode"
          value={settings.mode}
          options={["Dark", "Light"]}
          onChange={(v) => update({ mode: v })}
        />
        <div>
          <div className="text-[11px] text-text-faint mb-1.5">Accent Color</div>
          <div className="flex items-center gap-2">
            {accents.map((c) => (
              <button
                key={c}
                onClick={() => update({ accentColor: c })}
                className={`w-7 h-7 rounded-full transition-shadow ${
                  settings.accentColor === c ? "ring-2 ring-offset-2 ring-offset-card ring-accent" : ""
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <p className="text-[10.5px] text-text-faint mt-1.5">Both apply immediately across the whole app.</p>
        </div>
      </SettingsCard>

      <SettingsCard icon={LayoutGrid} title="Layout">
        <SelectField
          label="Dashboard Density"
          value={settings.dashboardDensity}
          options={["Comfortable", "Compact"]}
          onChange={(v) => update({ dashboardDensity: v })}
        />
        <SelectField
          label="Sidebar Default State"
          value={settings.sidebarDefaultState}
          options={["Expanded", "Collapsed"]}
          onChange={(v) => update({ sidebarDefaultState: v })}
        />
        <ToggleRow label="Show KPI Deltas" checked={settings.showKpiDeltas} onChange={(v) => update({ showKpiDeltas: v })} />
        <p className="text-[10.5px] text-text-faint">
          Density adjusts overall content spacing (not every individual card's internal padding), and Sidebar
          Default sets whether it starts collapsed on load \u2014 both take effect immediately. Show KPI Deltas isn't
          wired to anything yet.
        </p>
      </SettingsCard>

      <SettingsCard icon={Type} title="Typography">
        <SelectField
          label="Base Font Size"
          value={settings.baseFontSize}
          options={["Small", "Medium", "Large"]}
          onChange={(v) => update({ baseFontSize: v })}
        />
        <SelectField
          label="Number Format"
          value={settings.numberFormat}
          options={["1,234.56", "1.234,56", "1 234.56"]}
          onChange={(v) => update({ numberFormat: v })}
        />
        <ToggleRow
          label="Use Monospace for Figures"
          checked={settings.useMonospaceForFigures}
          onChange={(v) => update({ useMonospaceForFigures: v })}
        />
      </SettingsCard>
    </div>
  );
}

export default function Settings({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [tab, setTab] = useState("General");
  const { data: fetched, refetch } = useApiData<StationSettings>("/settings");
  const [settings, setSettings] = useState<StationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (fetched && !settings) setSettings(fetched);
  }, [fetched, settings]);

  useEffect(() => {
    if (settings?.appearance.accentColor) {
      document.documentElement.style.setProperty("--color-accent", settings.appearance.accentColor);
    }
    if (settings?.appearance.mode) {
      document.documentElement.classList.toggle("light", settings.appearance.mode === "Light");
    }
  }, [settings?.appearance.accentColor, settings?.appearance.mode]);

  function updateSection<K extends keyof StationSettings>(section: K, patch: Partial<StationSettings[K]>) {
    setSettings((prev) => (prev ? { ...prev, [section]: { ...prev[section], ...patch } } : prev));
    setSaveState("idle");
  }

  function updateIntegration(id: string, state: IntegrationState) {
    setSettings((prev) => (prev ? { ...prev, integrations: { ...prev.integrations, [id]: state } } : prev));
    setSaveState("idle");
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setSaveState("idle");
    try {
      await api.put("/settings", settings);
      setSaveState("saved");
      refetch();
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      alert(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Configure system preferences and manage platform settings" />
        <div className="card p-10 text-center text-text-faint text-[13px]">Loading settings&hellip;</div>
      </div>
    );
  }

  function renderTab() {
    if (!settings) return null;
    switch (tab) {
      case "General":
        return <GeneralTab settings={settings.general} update={(p) => updateSection("general", p)} onNavigate={onNavigate} />;
      case "Fuel & Pricing":
        return <FuelPricingTab settings={settings.fuelPricing} update={(p) => updateSection("fuelPricing", p)} />;
      case "Devices":
        return <DevicesTab settings={settings.devices} update={(p) => updateSection("devices", p)} onNavigate={onNavigate} />;
      case "Integrations":
        return <IntegrationsTab integrations={settings.integrations} update={updateIntegration} />;
      case "Notifications":
        return <NotificationsTab settings={settings.notifications} update={(p) => updateSection("notifications", p)} />;
      case "Security":
        return <SecurityTab settings={settings.security} update={(p) => updateSection("security", p)} />;
      case "Backup & Data":
        return <BackupDataTab settings={settings.backup} update={(p) => updateSection("backup", p)} onBackupComplete={refetch} />;
      case "Appearance":
        return <AppearanceTab settings={settings.appearance} update={(p) => updateSection("appearance", p)} />;
      default:
        return null;
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure system preferences and manage platform settings"
        actions={
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-bg text-[12px] font-medium disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Saving&hellip;
              </>
            ) : saveState === "saved" ? (
              <>
                <Check size={13} /> Saved
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        }
      />

      <div className="flex items-center gap-1 mb-4 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 text-[12.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t ? "border-accent text-accent font-medium" : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}