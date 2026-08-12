import {
  LayoutDashboard,
  Radio,
  ShoppingCart,
  CreditCard,
  Fuel,
  Droplets,
  GaugeCircle,
  Cpu,
  Package,
  Truck,
  Tag,
  Building2,
  Heart,
  Users,
  DollarSign,
  Wallet,
  Clock,
  Wrench,
  FileText,
  BarChart3,
  Bell,
  ScrollText,
  UserCog,
  Settings,
  ShieldCheck,
  Activity,
  ChevronLeft,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS } from "../data/mock";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  "live-forecourt": Radio,
  sales: ShoppingCart,
  pos: CreditCard,
  dispensers: Fuel,
  nozzles: Droplets,
  "fuel-tanks": Fuel,
  "tank-gauges": GaugeCircle,
  controllers: Cpu,
  inventory: Package,
  deliveries: Truck,
  "price-management": Tag,
  "fleet-accounts": Building2,
  loyalty: Heart,
  crm: Users,
  finance: DollarSign,
  "cash-management": Wallet,
  shifts: Clock,
  maintenance: Wrench,
  reports: FileText,
  analytics: BarChart3,
  alerts: Bell,
  "audit-logs": ScrollText,
  users: UserCog,
  settings: Settings,
  administration: ShieldCheck,
  "system-health": Activity,
};

export default function Sidebar({
  active,
  onSelect,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  active: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  function handleSelect(key: string) {
    onSelect(key);
    onCloseMobile();
  }

  return (
    <>
      {/* Backdrop: mobile/tablet only, closes the drawer on tap-outside.
          Above the lg breakpoint the sidebar is always visible in the flex
          layout, so this never renders there regardless of mobileOpen. */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`shrink-0 h-full flex flex-col bg-[var(--color-panel)] border-r border-[var(--color-border)] transition-[width] duration-200
          fixed inset-y-0 left-0 z-50 transition-transform lg:static lg:translate-x-0 lg:transition-[width]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          ${collapsed ? "lg:w-[76px]" : "lg:w-[248px]"} w-[248px]`}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-[10px] bg-[var(--color-accent)] grid place-items-center shrink-0">
            <Flame size={18} className="text-[#081018]" strokeWidth={2.5} />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="leading-tight overflow-hidden">
              <div className="text-[15px] font-semibold text-[var(--color-text)] whitespace-nowrap">
                FuelMaster
              </div>
              <div className="text-[10.5px] text-[var(--color-text-faint)] whitespace-nowrap">
                Forecourt Management
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              {(!collapsed || mobileOpen) && (
                <div className="px-2.5 mb-1.5 text-[10px] font-semibold tracking-[0.08em] text-[var(--color-text-faint)] uppercase">
                  {group.title}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = ICONS[item.key] ?? LayoutDashboard;
                  const isActive = item.key === active;
                  return (
                    <li key={item.key}>
                      <button
                        onClick={() => handleSelect(item.key)}
                        title={collapsed && !mobileOpen ? item.label : undefined}
                        className={`w-full flex items-center gap-3 rounded-[8px] px-2.5 py-[9px] text-[13px] transition-colors ${
                          isActive
                            ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-medium"
                            : "text-[var(--color-text-dim)] hover:bg-white/[0.04] hover:text-[var(--color-text)]"
                        }`}
                      >
                        <Icon size={16} strokeWidth={2} className="shrink-0" />
                        {(!collapsed || mobileOpen) && (
                          <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                            {item.label}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--color-border)] p-2.5 hidden lg:block">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center gap-3 rounded-[8px] px-2.5 py-[9px] text-[13px] text-[var(--color-text-dim)] hover:bg-white/[0.04] hover:text-[var(--color-text)] transition-colors"
          >
            <ChevronLeft
              size={16}
              className={`shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}