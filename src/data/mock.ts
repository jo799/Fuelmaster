import type {
  Pump,
  Transaction,
  ForecourtEvent,
  NavItem,
  Nozzle,
  Tank,
  Controller,
  SaleRow,
  CashTransaction,
  StationCashPosition,
  ReportRow,
  AdminUser,
  ActivityLogEntry,
  ShiftRow,
  CrmCustomer,
  DeliveryRow,
  FleetAccountRow,
  InventoryItem,
  LoyaltyMember,
  WorkOrder,
  FuelPriceRow,
  AuditLogEntry,
  AlertRow,
  StationFinance,
} from "../types";

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operations",
    items: [
      { key: "dashboard", label: "Dashboard" },
      { key: "live-forecourt", label: "Live Forecourt" },
      { key: "sales", label: "Sales" },
      { key: "pos", label: "POS" },
      { key: "dispensers", label: "Dispensers" },
      { key: "nozzles", label: "Nozzles" },
      { key: "fuel-tanks", label: "Fuel Tanks" },
      { key: "tank-gauges", label: "Tank Gauges" },
      { key: "controllers", label: "Controllers" },
    ],
  },
  {
    title: "Commercial",
    items: [
      { key: "inventory", label: "Inventory" },
      { key: "deliveries", label: "Deliveries" },
      { key: "price-management", label: "Price Management" },
      { key: "fleet-accounts", label: "Fleet Accounts" },
      { key: "loyalty", label: "Loyalty" },
      { key: "crm", label: "CRM" },
    ],
  },
  {
    title: "Back Office",
    items: [
      { key: "finance", label: "Finance" },
      { key: "cash-management", label: "Cash Management" },
      { key: "shifts", label: "Shift Operations" },
      { key: "maintenance", label: "Maintenance" },
      { key: "reports", label: "Reports" },
      { key: "analytics", label: "Analytics" },
    ],
  },
  {
    title: "System",
    items: [
      { key: "alerts", label: "Alerts" },
      { key: "audit-logs", label: "Audit Logs" },
      { key: "users", label: "Users" },
      { key: "settings", label: "Settings" },
      { key: "administration", label: "Administration" },
      { key: "system-health", label: "System Health" },
    ],
  },
];

export const INITIAL_PUMPS: Pump[] = [
  { id: 1, name: "Pump 1", status: "dispensing", nozzle: 1, product: "Petrol", amountKes: 5600, litres: 32.0, flowRate: 175.0, elapsedSec: 48, controller: "CTRL-01", x: 14, y: 14, targetLitres: 38 },
  { id: 2, name: "Pump 2", status: "idle", nozzle: 1, product: "Diesel", amountKes: 0, litres: 0, flowRate: 0, elapsedSec: 0, controller: "CTRL-01", x: 38, y: 9 },
  { id: 3, name: "Pump 3", status: "dispensing", nozzle: 1, product: "Petrol", amountKes: 3600, litres: 20.0, flowRate: 96.0, elapsedSec: 32, controller: "CTRL-01", x: 62, y: 13, targetLitres: 27 },
  { id: 4, name: "Pump 4", status: "offline", nozzle: 1, product: "Diesel", amountKes: 0, litres: 0, flowRate: 0, elapsedSec: 0, controller: "CTRL-01", x: 86, y: 8 },
  { id: 5, name: "Pump 5", status: "dispensing", nozzle: 1, product: "Kerosene", amountKes: 2790, litres: 15.5, flowRate: 88.0, elapsedSec: 21, controller: "CTRL-01", x: 26, y: 63, targetLitres: 22 },
  { id: 6, name: "Pump 6", status: "offline", nozzle: 1, product: "Petrol", amountKes: 0, litres: 0, flowRate: 0, elapsedSec: 0, controller: "CTRL-01", x: 74, y: 65 },
];

export const INITIAL_EVENTS: ForecourtEvent[] = [
  { id: "e1", time: "10:30", message: "Pump 1 dispensing started", level: "success", ago: "Just now" },
  { id: "e2", time: "10:29", message: "Price changed \u2013 Diesel to KES 180.00", level: "warning", ago: "1 min ago" },
  { id: "e3", time: "10:28", message: "Tank 1 low level warning", level: "danger", ago: "2 min ago" },
  { id: "e4", time: "10:27", message: "Pump 4 offline", level: "danger", ago: "3 min ago" },
  { id: "e5", time: "10:25", message: "Delivery completed \u2013 Kerosene", level: "success", ago: "5 min ago" },
];

export function pumpsToTransactions(pumps: Pump[]): Transaction[] {
  return pumps
    .filter((p) => p.status === "dispensing")
    .map((p) => ({
      id: `TXN-${p.id}`,
      pump: p.id,
      nozzle: p.nozzle,
      litres: p.litres,
      amountKes: p.amountKes,
      elapsedSec: p.elapsedSec,
    }));
}

export const INITIAL_NOZZLES: Nozzle[] = [
  { id: 1, dispenser: "Pump 1", product: "Petrol", status: "online", flowRate: 45.2, todayLitres: 320.0, todayKes: 57600, lastDispensed: "2 min ago" },
  { id: 2, dispenser: "Pump 1", product: "Diesel", status: "online", flowRate: 38.7, todayLitres: 210.0, todayKes: 37800, lastDispensed: "5 min ago" },
  { id: 3, dispenser: "Pump 2", product: "Kerosene", status: "dispensing", flowRate: 28.4, todayLitres: 85.0, todayKes: 12750, lastDispensed: "00:01:32" },
  { id: 4, dispenser: "Pump 2", product: "Petrol", status: "online", flowRate: 0, todayLitres: 0, todayKes: 0, lastDispensed: "\u2014" },
  { id: 5, dispenser: "Pump 3", product: "Diesel", status: "offline", flowRate: 0, todayLitres: 0, todayKes: 0, lastDispensed: "07:45 AM" },
  { id: 6, dispenser: "Pump 3", product: "Petrol", status: "online", flowRate: 0, todayLitres: 0, todayKes: 0, lastDispensed: "\u2014" },
  { id: 7, dispenser: "Pump 4", product: "Diesel", status: "online", flowRate: 0, todayLitres: 0, todayKes: 0, lastDispensed: "\u2014" },
  { id: 8, dispenser: "Pump 4", product: "Kerosene", status: "online", flowRate: 0, todayLitres: 0, todayKes: 0, lastDispensed: "\u2014" },
];

export const INITIAL_TANKS: Tank[] = [
  { id: "TANK-1", product: "Petrol", capacity: 32000, volume: 18560, temperature: 24, waterLevel: 0.5, density: 0.745, atgOnline: true, status: "healthy", refillDays: 5, emptyDays: 12 },
  { id: "TANK-2", product: "Diesel", capacity: 22000, volume: 12980, temperature: 26, waterLevel: 0.8, density: 0.842, atgOnline: true, status: "healthy", refillDays: 6, emptyDays: 17 },
  { id: "TANK-3", product: "Kerosene", capacity: 15000, volume: 6750, temperature: 25, waterLevel: 0.3, density: 0.819, atgOnline: true, status: "warning", refillDays: 9, emptyDays: 4 },
  { id: "TANK-4", product: "Petrol", capacity: 20000, volume: 15400, temperature: 24, waterLevel: 0.0, density: 0.746, atgOnline: true, status: "healthy", refillDays: 3, emptyDays: 10 },
  { id: "TANK-5", product: "Diesel", capacity: 18500, volume: 4250, temperature: 27, waterLevel: 1.2, density: 0.848, atgOnline: true, status: "warning", refillDays: 17, emptyDays: 2 },
  { id: "TANK-6", product: "Petrol", capacity: 10000, volume: 9100, temperature: 23, waterLevel: 0.0, density: 0.747, atgOnline: true, status: "healthy", refillDays: 1, emptyDays: 9 },
  { id: "TANK-7", product: "Diesel", capacity: 6000, volume: 1850, temperature: 28, waterLevel: 0.0, density: 0.841, atgOnline: true, status: "warning", refillDays: 12, emptyDays: 2 },
  { id: "TANK-8", product: "LPG", capacity: 5000, volume: 2250, temperature: 22, waterLevel: 0, density: 1.912, atgOnline: true, status: "healthy", refillDays: 8, emptyDays: 6 },
];

export const INITIAL_CONTROLLERS: Controller[] = [
  { id: "C-001", station: "Kariakoo STN-001", model: "Gilbarco Encore S", status: "online", pumps: 4, pumpsOnline: 4, dispensers: 4, nozzles: 8, uptime: "23d 5h", lastSeen: "2s ago" },
  { id: "C-002", station: "Mikocheni STN-002", model: "Wayne Helix 7000", status: "online", pumps: 6, pumpsOnline: 6, dispensers: 6, nozzles: 12, uptime: "15d 2h", lastSeen: "5s ago" },
  { id: "C-003", station: "Upanga STN-003", model: "Tatsuno N Series", status: "online", pumps: 4, pumpsOnline: 4, dispensers: 4, nozzles: 8, uptime: "31d 8h", lastSeen: "3s ago" },
  { id: "C-004", station: "Kibaha STN-004", model: "Gilbarco Encore S", status: "offline", pumps: 4, pumpsOnline: 0, dispensers: 4, nozzles: 8, uptime: "0h", lastSeen: "2h 14m ago" },
  { id: "C-005", station: "Bagamoyo STN-005", model: "Wayne Ovation", status: "maintenance", pumps: 4, pumpsOnline: 4, dispensers: 4, nozzles: 8, uptime: "5d 6h", lastSeen: "12m ago" },
];

export const INITIAL_SALES: SaleRow[] = [
  { receipt: "00001234", time: "10:30:15", pump: "Pump 2", nozzle: 1, cashier: "John M.", customer: "John Mwangi", product: "Petrol", litres: 32.0, price: 180, amountKes: 5760, payment: "Cash", status: "completed" },
  { receipt: "00001233", time: "10:29:48", pump: "Pump 3", nozzle: 1, cashier: "Jane W.", customer: "Jane Wanjiku", product: "Diesel", litres: 15.5, price: 175, amountKes: 2713, payment: "Card", status: "completed" },
  { receipt: "00001232", time: "10:28:22", pump: "Pump 1", nozzle: 2, cashier: "Peter K.", customer: "Peter Kariuki", product: "Petrol", litres: 20.0, price: 180, amountKes: 3600, payment: "Cash", status: "completed" },
  { receipt: "00001231", time: "10:27:55", pump: "Pump 2", nozzle: 1, cashier: "Samuel O.", customer: "Samuel Otieno", product: "Diesel", litres: 25.0, price: 175, amountKes: 4375, payment: "Card", status: "completed" },
  { receipt: "00001230", time: "10:27:11", pump: "Pump 1", nozzle: 1, cashier: "Grace A.", customer: "Grace Achieng'", product: "Petrol", litres: 18.0, price: 180, amountKes: 3240, payment: "Cash", status: "completed" },
  { receipt: "00001229", time: "10:26:45", pump: "Pump 3", nozzle: 2, cashier: "David M.", customer: "David Mutinda", product: "Kerosene", litres: 10.0, price: 120, amountKes: 1200, payment: "Mobile Money", status: "completed" },
  { receipt: "00001228", time: "10:25:30", pump: "Pump 4", nozzle: 1, cashier: "Mary N.", customer: "Mary Njeri", product: "Diesel", litres: 30.0, price: 175, amountKes: 5250, payment: "Fleet Account", status: "completed" },
  { receipt: "00001227", time: "10:24:15", pump: "Pump 5", nozzle: 1, cashier: "John K.", customer: "Kariuki Logistics", product: "Petrol", litres: 40.0, price: 180, amountKes: 7200, payment: "Card", status: "completed" },
];

export const FUEL_PRICES: Record<string, number> = {
  Petrol: 180,
  Diesel: 165,
  Kerosene: 150,
};

export const INITIAL_CASH_TXNS: CashTransaction[] = [
  { id: "DEP-000125", date: "Jul 17, 2026 10:15 AM", type: "Cash In", description: "Deposit from Bank", station: "Kariakoo Service Station", amountKes: 150000, method: "Cash", reference: "DEP-000125", status: "completed" },
  { id: "CO-000456", date: "Jul 17, 2026 09:42 AM", type: "Cash Out", description: "Fuel Purchase (Supplier)", station: "Mbagala Service Station", amountKes: -75000, method: "Cash", reference: "CO-000456", status: "completed" },
  { id: "DEP-000124", date: "Jul 17, 2026 09:10 AM", type: "Cash In", description: "Cash Collection", station: "Temeke Service Station", amountKes: 200000, method: "Cash", reference: "DEP-000124", status: "completed" },
  { id: "CO-000455", date: "Jul 17, 2026 08:55 AM", type: "Cash Out", description: "Miscellaneous Expense", station: "Kisutu Service Station", amountKes: -12500, method: "Cash", reference: "CO-000455", status: "completed" },
  { id: "DEP-000123", date: "Jul 16, 2026 04:30 PM", type: "Cash In", description: "Bank Deposit", station: "Kariakoo Service Station", amountKes: 300000, method: "Bank Transfer", reference: "DEP-000123", status: "completed" },
];

export const CASH_POSITIONS: StationCashPosition[] = [
  { station: "Kariakoo Service Station", onHand: 96750, limit: 120000 },
  { station: "Mbagala Service Station", onHand: 72450, limit: 100000 },
  { station: "Temeke Service Station", onHand: 58620, limit: 100000 },
  { station: "Kisutu Service Station", onHand: 42310, limit: 80000 },
];

export const INITIAL_REPORTS: ReportRow[] = [
  { name: "Daily Sales Summary", category: "Sales", generatedOn: "Jul 17, 2026 09:30 AM", period: "Jul 11 - Jul 17, 2026", format: "PDF", status: "Completed" },
  { name: "Fuel Consumption Report", category: "Fuel", generatedOn: "Jul 17, 2026 09:15 AM", period: "Jul 11 - Jul 17, 2026", format: "PDF", status: "Completed" },
  { name: "Inventory Movement Report", category: "Inventory", generatedOn: "Jul 16, 2026 08:45 AM", period: "Jul 11 - Jul 17, 2026", format: "Excel", status: "Completed" },
  { name: "Delivery Performance Report", category: "Deliveries", generatedOn: "Jul 16, 2026 08:30 AM", period: "Jul 11 - Jul 17, 2026", format: "PDF", status: "Completed" },
  { name: "Price Change Report", category: "Price Management", generatedOn: "Jul 15, 2026 04:20 PM", period: "Jul 11 - Jul 17, 2026", format: "Excel", status: "Completed" },
  { name: "Customer Loyalty Report", category: "Loyalty", generatedOn: "Jul 15, 2026 03:50 PM", period: "Jul 11 - Jul 17, 2026", format: "PDF", status: "Completed" },
  { name: "CRM Activity Report", category: "CRM", generatedOn: "Jul 15, 2026 03:30 PM", period: "Jul 11 - Jul 17, 2026", format: "PDF", status: "Processing" },
  { name: "Fleet Account Summary", category: "Fleet Accounts", generatedOn: "Jul 14, 2026 11:45 AM", period: "Jul 11 - Jul 17, 2026", format: "Excel", status: "Completed" },
];

export const INITIAL_ADMIN_USERS: AdminUser[] = [
  { name: "John Kamau", email: "john.kamau@fuelmaster.dev", role: "Cashier", station: "STN-001", status: "Active", lastLogin: "Jul 17, 2026 08:15 AM", createdOn: "May 12, 2025" },
  { name: "Grace Wanjiku", email: "grace.wanjiku@fuelmaster.dev", role: "Manager", station: "STN-001", status: "Active", lastLogin: "Jul 16, 2026 06:30 PM", createdOn: "May 08, 2025" },
  { name: "David Kimani", email: "david.kimani@fuelmaster.dev", role: "Cashier", station: "STN-002", status: "Active", lastLogin: "Jul 16, 2026 05:10 PM", createdOn: "May 15, 2025" },
  { name: "Peter Mwangi", email: "peter.mwangi@fuelmaster.dev", role: "Supervisor", station: "STN-003", status: "Active", lastLogin: "Jul 16, 2026 04:20 PM", createdOn: "May 14, 2025" },
  { name: "Amina Juma", email: "amina.juma@fuelmaster.dev", role: "Controller", station: "STN-001", status: "Active", lastLogin: "Jul 15, 2026 02:10 PM", createdOn: "May 10, 2025" },
  { name: "Joseph Mburu", email: "joseph.mburu@fuelmaster.dev", role: "Administrator", station: "STN-002", status: "Suspended", lastLogin: "Jul 14, 2026 11:45 AM", createdOn: "May 09, 2025" },
];

export const RECENT_ACTIVITY: ActivityLogEntry[] = [
  { id: "a1", message: "Admin created user David Kimani", time: "Jul 17, 2026 10:15 AM", tone: "success" },
  { id: "a2", message: "Manager updated role for Grace Wanjiku", time: "Jul 16, 2026 04:20 PM", tone: "info" },
  { id: "a3", message: "Cashier login failed (3 attempts)", time: "Jul 16, 2026 09:12 AM", tone: "danger" },
  { id: "a4", message: "Supervisor updated user Peter Mwangi", time: "Jul 15, 2026 03:45 PM", tone: "info" },
  { id: "a5", message: "Admin created user Amina Juma", time: "Jul 15, 2026 02:30 PM", tone: "success" },
];

export const INITIAL_SHIFTS: ShiftRow[] = [
  { id: "SFT-028", date: "Jul 17, 2026", time: "08:00 AM - 04:00 PM", cashier: "John Kamau", station: "STN-001", transactions: 128, salesKes: 98540, status: "In Progress" },
  { id: "SFT-027", date: "Jul 16, 2026", time: "08:00 AM - 04:00 PM", cashier: "Amina Juma", station: "STN-001", transactions: 121, salesKes: 104230, status: "Completed" },
  { id: "SFT-026", date: "Jul 16, 2026", time: "04:00 PM - 12:00 AM", cashier: "David Kimani", station: "STN-002", transactions: 92, salesKes: 76410, status: "Completed" },
  { id: "SFT-025", date: "Jul 16, 2026", time: "12:00 AM - 08:00 AM", cashier: "Grace Wanjiku", station: "STN-001", transactions: 65, salesKes: 54120, status: "Completed" },
  { id: "SFT-024", date: "Jul 15, 2026", time: "08:00 AM - 04:00 PM", cashier: "Peter Mwangi", station: "STN-003", transactions: 110, salesKes: 88760, status: "Completed" },
  { id: "SFT-023", date: "Jul 15, 2026", time: "04:00 PM - 12:00 AM", cashier: "Amina Juma", station: "STN-002", transactions: 98, salesKes: 71450, status: "Completed" },
];

export const TOP_CASHIERS = [
  { name: "John Kamau", salesKes: 612350 },
  { name: "Amina Juma", salesKes: 442210 },
  { name: "Grace Wanjiku", salesKes: 328450 },
  { name: "David Kimani", salesKes: 271600 },
  { name: "Peter Mwangi", salesKes: 201980 },
];

export const INITIAL_CRM_CUSTOMERS: CrmCustomer[] = [
  { name: "Peter Mwangi", company: "Kariakoo Logistics Ltd", contact: "0721 234 567", segment: "VIP", status: "Active", lastInteraction: "Jul 16, 2026 9:30 AM", totalSpentKes: 125680 },
  { name: "Amina Juma", company: "Tanzania Transport Co", contact: "0722 456 789", segment: "Gold", status: "Active", lastInteraction: "Jul 16, 2026 2:15 PM", totalSpentKes: 98450 },
  { name: "David Kimani", company: "Pamoja Delivery Services", contact: "0703 567 890", segment: "Silver", status: "Active", lastInteraction: "Jul 16, 2026 11:45 AM", totalSpentKes: 76200 },
  { name: "Grace Wanjiku", company: "Green Line Transport", contact: "0721 234 567", segment: "Bronze", status: "Active", lastInteraction: "Jul 15, 2026 4:20 PM", totalSpentKes: 42800 },
  { name: "James Otieno", company: "City Courier Ltd", contact: "0734 567 890", segment: "Gold", status: "Active", lastInteraction: "Jul 15, 2026 10:10 AM", totalSpentKes: 63750 },
  { name: "Susan Njeri", company: "Swift Fleet Solutions", contact: "0717 890 123", segment: "Bronze", status: "Active", lastInteraction: "Jul 15, 2026 9:05 AM", totalSpentKes: 24560 },
  { name: "Faith Wanjala", company: "Pan African Transport", contact: "0798 123 456", segment: "Silver", status: "Active", lastInteraction: "Jul 14, 2026 3:45 PM", totalSpentKes: 52300 },
];

export const CRM_UPCOMING_FOLLOWUPS = [
  { name: "James Otieno", date: "Jul 19, 2026 10:00 AM", type: "Call" },
  { name: "Susan Njeri", date: "Jul 20, 2026 2:00 PM", type: "Email" },
  { name: "David Kimani", date: "Jul 20, 2026 11:00 AM", type: "Meeting" },
];

export const INITIAL_DELIVERIES: DeliveryRow[] = [
  { id: "DEL-10012", date: "Jul 17, 2026 10:30 AM", supplier: "PetroWash Ltd", fuelType: "Diesel", quantityL: 12000, costKes: 350400, status: "Received", note: "PN-7845" },
  { id: "DEL-10011", date: "Jul 16, 2026 4:15 PM", supplier: "Kerosene Supply Co.", fuelType: "Kerosene", quantityL: 5000, costKes: 102500, status: "Received", note: "PN-7844" },
  { id: "DEL-10010", date: "Jul 16, 2026 11:20 AM", supplier: "OilCom Ltd", fuelType: "Petrol", quantityL: 8750, costKes: 201500, status: "Received", note: "PN-7843" },
  { id: "DEL-10009", date: "Jul 15, 2026 3:45 PM", supplier: "Petro Supply Co.", fuelType: "Diesel", quantityL: 10000, costKes: 290000, status: "In Transit", note: "PN-7842" },
  { id: "DEL-10008", date: "Jul 15, 2026 9:30 AM", supplier: "Kerosene Supply Co.", fuelType: "Kerosene", quantityL: 2500, costKes: 51250, status: "Received", note: "PN-7841" },
  { id: "DEL-10007", date: "Jul 14, 2026 4:00 PM", supplier: "OilCom Ltd", fuelType: "Petrol", quantityL: 7000, costKes: 161000, status: "Received", note: "PN-7840" },
  { id: "DEL-10004", date: "Jul 12, 2026 9:15 AM", supplier: "Kerosene Supply Co.", fuelType: "Kerosene", quantityL: 3000, costKes: 61500, status: "Scheduled", note: "PN-7837" },
  { id: "DEL-10003", date: "Jul 11, 2026 2:45 PM", supplier: "Petro Supply Co.", fuelType: "Diesel", quantityL: 9000, costKes: 261000, status: "Cancelled", note: "PN-7836" },
];

export const DELIVERIES_UPCOMING = [
  { date: "Jul 19, 2026 9:00 AM", supplier: "Kerosene Supply Co.", quantityL: 3000 },
  { date: "Jul 19, 2026 2:00 PM", supplier: "Petro Supply Co.", quantityL: 7000 },
];

export const INITIAL_FLEET_ACCOUNTS: FleetAccountRow[] = [
  { name: "Kariakoo Logistics Ltd", accountId: "FA-1001", group: "Logistics", contact: "Peter Mwangi", vehicles: 12, creditLimitKes: 1500000, balanceKes: 320450, status: "Active" },
  { name: "Tanzania Transport Co", accountId: "FA-1002", group: "Transport", contact: "Amina Juma", vehicles: 8, creditLimitKes: 1000000, balanceKes: 150250, status: "Active" },
  { name: "Pamoja Delivery Services", accountId: "FA-1003", group: "Logistics", contact: "David Simba", vehicles: 6, creditLimitKes: 500000, balanceKes: 85600, status: "Active" },
  { name: "Green Line Transport", accountId: "FA-1004", group: "Transport", contact: "Moses Mrema", vehicles: 5, creditLimitKes: 500000, balanceKes: 120750, status: "Active" },
  { name: "City Courier Ltd", accountId: "FA-1005", group: "Courier", contact: "Sarah Nchimbi", vehicles: 4, creditLimitKes: 300000, balanceKes: 78900, status: "Active" },
  { name: "Soko Express Ltd", accountId: "FA-1006", group: "Logistics", contact: "James Baraka", vehicles: 7, creditLimitKes: 750000, balanceKes: 210300, status: "Over Limit" },
  { name: "Pan African Transport", accountId: "FA-1009", group: "Transport", contact: "Ali Hassan", vehicles: 10, creditLimitKes: 1200000, balanceKes: 420600, status: "Over Limit" },
];

export const FLEET_OVER_LIMIT = [
  { name: "Pan African Transport", balanceKes: 420600 },
  { name: "Soko Express Ltd", balanceKes: 210300 },
  { name: "Kamilu Logistics", balanceKes: 95000 },
];

export const FLEET_BALANCE_TREND = [
  { d: "Jul 11", v: 520000 }, { d: "Jul 12", v: 560000 }, { d: "Jul 13", v: 540000 },
  { d: "Jul 14", v: 590000 }, { d: "Jul 15", v: 610000 }, { d: "Jul 16", v: 630000 }, { d: "Jul 17", v: 645230 },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { name: "Diesel (ENS90)", category: "Fuel", location: "Tank 1", unit: "Liters", quantity: 12450, costKes: 104.5, valueKes: 1299525, status: "In Stock" },
  { name: "Petrol (PMS 95)", category: "Fuel", location: "Tank 2", unit: "Liters", quantity: 8760, costKes: 121, valueKes: 1059960, status: "In Stock" },
  { name: "Kerosene", category: "Fuel", location: "Tank 3", unit: "Liters", quantity: 3250, costKes: 98, valueKes: 318500, status: "Low Stock" },
  { name: "Engine Oil 20W-50", category: "Lubricants", location: "Store 1", unit: "Liters", quantity: 45, costKes: 650, valueKes: 29250, status: "In Stock" },
  { name: "Engine Oil 15W-40", category: "Lubricants", location: "Store 1", unit: "Liters", quantity: 23, costKes: 620, valueKes: 14260, status: "Low Stock" },
  { name: "ATF (Transmission Fluid)", category: "Lubricants", location: "Store 1", unit: "Liters", quantity: 12, costKes: 950, valueKes: 11400, status: "Low Stock" },
  { name: "Grease (Multi-Purpose)", category: "Lubricants", location: "Store 2", unit: "Kg", quantity: 8, costKes: 300, valueKes: 2400, status: "In Stock" },
  { name: "AdBlue (10L)", category: "Other Products", location: "Store 2", unit: "Liters", quantity: 15, costKes: 180, valueKes: 2700, status: "In Stock" },
  { name: "Windshield Washer Fluid", category: "Other Products", location: "Store 2", unit: "Liters", quantity: 6, costKes: 120, valueKes: 720, status: "Out of Stock" },
  { name: "Fuel Filter (Diesel)", category: "Other Products", location: "Store 3", unit: "Units", quantity: 3, costKes: 450, valueKes: 1350, status: "Out of Stock" },
];

export const INVENTORY_LOW_STOCK = [
  { name: "Kerosene", quantity: "3,250 L" },
  { name: "Engine Oil 15W-40", quantity: "23 L" },
  { name: "ATF (Transmission Fluid)", quantity: "12 L" },
  { name: "Windshield Washer Fluid", quantity: "6 L" },
];

export const INVENTORY_MOVEMENTS = [
  { item: "Diesel (ENS90) \u2013 Sale", delta: -1000, unit: "L", ago: "10 min ago" },
  { item: "Diesel (ENS90) \u2013 Delivery", delta: 5000, unit: "L", ago: "1 hr ago" },
  { item: "Engine Oil 20W-50 \u2013 Purchase", delta: 50, unit: "L", ago: "2 hr ago" },
  { item: "Kerosene \u2013 Sale", delta: -500, unit: "L", ago: "3 hr ago" },
  { item: "AdBlue \u2013 Delivery", delta: 20, unit: "L", ago: "4 hr ago" },
];

export const INITIAL_LOYALTY_MEMBERS: LoyaltyMember[] = [
  { id: "LM-1001248", name: "Peter Mwangi", phone: "0712 345 678", tier: "Gold", pointsBalance: 2450, lifetimePoints: 12500, totalSpentKes: 45800, joined: "Jan 12, 2025", status: "Active" },
  { id: "LM-1001247", name: "Amina Juma", phone: "0722 456 789", tier: "Gold", pointsBalance: 1850, lifetimePoints: 8900, totalSpentKes: 32600, joined: "Feb 03, 2025", status: "Active" },
  { id: "LM-1001246", name: "David Kimani", phone: "0703 567 890", tier: "Silver", pointsBalance: 980, lifetimePoints: 4650, totalSpentKes: 18750, joined: "Mar 20, 2025", status: "Active" },
  { id: "LM-1001245", name: "Grace Wanjiku", phone: "0721 234 567", tier: "Bronze", pointsBalance: 320, lifetimePoints: 1850, totalSpentKes: 6420, joined: "Apr 15, 2025", status: "Active" },
  { id: "LM-1001244", name: "James Otieno", phone: "0734 567 890", tier: "Gold", pointsBalance: 2900, lifetimePoints: 15600, totalSpentKes: 55200, joined: "Jan 05, 2025", status: "Active" },
  { id: "LM-1001243", name: "Susan Njeri", phone: "0717 890 123", tier: "Bronze", pointsBalance: 150, lifetimePoints: 540, totalSpentKes: 3100, joined: "May 01, 2026", status: "Pending" },
  { id: "LM-1001242", name: "Faith Wanjala", phone: "0798 123 456", tier: "Silver", pointsBalance: 750, lifetimePoints: 3450, totalSpentKes: 12400, joined: "Apr 10, 2025", status: "Active" },
];

export const LOYALTY_TOP_MEMBERS = [
  { name: "James Otieno", points: 15600 },
  { name: "Peter Mwangi", points: 12500 },
  { name: "Amina Juma", points: 8900 },
];

export const LOYALTY_ACTIVITY = [
  { message: "Redeemed 500 points \u2013 Fuel Voucher", ago: "2m ago", tone: "warning" as const },
  { message: "Earned 100 points \u2013 Fuel Purchase", ago: "5m ago", tone: "success" as const },
  { message: "Redeemed 1,000 points \u2013 Free Car Wash", ago: "12m ago", tone: "warning" as const },
  { message: "Earned 150 points \u2013 Fuel Purchase", ago: "15m ago", tone: "success" as const },
  { message: "Redeemed 2,000 points \u2013 Discount Coupon", ago: "20m ago", tone: "warning" as const },
];

export const INITIAL_WORK_ORDERS: WorkOrder[] = [
  { id: "WO-10028", description: "Fuel Dispenser 2 - Nozzle Leak", asset: "Dispenser 2", type: "Corrective", priority: "High", status: "In Progress", assignedTo: "Brian Otieno", dueDate: "Jul 17, 2026" },
  { id: "WO-10027", description: "Tank Gauge Calibration", asset: "Tank 1", type: "Preventive", priority: "Medium", status: "Scheduled", assignedTo: "Unassigned", dueDate: "Jul 20, 2026" },
  { id: "WO-10026", description: "Generator - Oil Change", asset: "Generator", type: "Preventive", priority: "Medium", status: "Scheduled", assignedTo: "Unassigned", dueDate: "Jul 21, 2026" },
  { id: "WO-10025", description: "AC - Service", asset: "HVAC", type: "Corrective", priority: "High", status: "In Progress", assignedTo: "Grace Wanjiku", dueDate: "Jul 17, 2026" },
  { id: "WO-10024", description: "Dispenser 4 - Display Not Working", asset: "Dispenser 4", type: "Corrective", priority: "Medium", status: "Completed", assignedTo: "Amina Juma", dueDate: "Jul 15, 2026" },
  { id: "WO-10023", description: "Tank 2 - Overfill Sensor Check", asset: "Tank 2", type: "Preventive", priority: "Low", status: "Completed", assignedTo: "David Kimani", dueDate: "Jul 14, 2026" },
];

export const MAINTENANCE_UPCOMING = [
  { title: "Generator - Full Service", date: "Jul 19, 2026", due: "Due in 1 day" },
  { title: "Dispenser Nozzle Inspection", date: "Jul 20, 2026", due: "Due in 2 days" },
  { title: "Tank Gauge Calibration", date: "Jul 21, 2026", due: "Due in 3 days" },
  { title: "Air Compressor Service", date: "Jul 22, 2026", due: "Due in 4 days" },
  { title: "Fuel Filter Replacement", date: "Jul 23, 2026", due: "Due in 5 days" },
];

export const MAINTENANCE_ASSETS = [
  { name: "Dispenser 4", ok: 4, total: 4, pct: 85 },
  { name: "Tank 5", ok: 5, total: 5, pct: 80 },
  { name: "Generator 1", ok: 1, total: 1, pct: 100 },
  { name: "HVAC 2", ok: 1, total: 2, pct: 50 },
  { name: "Other 3", ok: 1, total: 3, pct: 33 },
];

export const INITIAL_FUEL_PRICES: FuelPriceRow[] = [
  { fuel: "Diesel (ENS90)", currentPrice: 1295, previousPrice: 1255, effectiveFrom: "Jul 17, 2026 10:00 AM", status: "Active" },
  { fuel: "Petrol (PMS 95)", currentPrice: 1219, previousPrice: 1179, effectiveFrom: "Jul 17, 2026 10:00 AM", status: "Active" },
  { fuel: "Kerosene", currentPrice: 970, previousPrice: 990, effectiveFrom: "Jul 17, 2026 10:00 AM", status: "Active" },
  { fuel: "Engine Oil 20W-50", currentPrice: 2850, previousPrice: 2850, effectiveFrom: "Jul 16, 2026 9:00 AM", status: "Active" },
  { fuel: "Engine Oil 15W-40", currentPrice: 2600, previousPrice: 2600, effectiveFrom: "Jul 16, 2026 9:00 AM", status: "Active" },
  { fuel: "ATF (Transmission Fluid)", currentPrice: 1450, previousPrice: 1450, effectiveFrom: "Jul 16, 2026 9:00 AM", status: "Active" },
  { fuel: "Grease (Multi-Purpose)", currentPrice: 850, previousPrice: 850, effectiveFrom: "Jul 12, 2026 8:00 AM", status: "Active" },
  { fuel: "AdBlue (10L)", currentPrice: 180, previousPrice: 200, effectiveFrom: "Jul 12, 2026 8:00 AM", status: "Active" },
];

export const PRICE_TREND = [
  { d: "Jul 11", diesel: 1215, petrol: 1139, kerosene: 990 },
  { d: "Jul 12", diesel: 1225, petrol: 1149, kerosene: 990 },
  { d: "Jul 13", diesel: 1235, petrol: 1159, kerosene: 990 },
  { d: "Jul 14", diesel: 1245, petrol: 1169, kerosene: 990 },
  { d: "Jul 15", diesel: 1255, petrol: 1179, kerosene: 990 },
  { d: "Jul 16", diesel: 1255, petrol: 1179, kerosene: 990 },
  { d: "Jul 17", diesel: 1295, petrol: 1219, kerosene: 970 },
];

export const PRICE_HISTORY = [
  { date: "Jul 17, 2026 10:00 AM", fuel: "Diesel (ENS90)", oldPrice: 1255, newPrice: 1295, changedBy: "John Kamau", reason: "Market Adjustment" },
  { date: "Jul 17, 2026 10:00 AM", fuel: "Petrol (PMS 95)", oldPrice: 1179, newPrice: 1219, changedBy: "John Kamau", reason: "Market Adjustment" },
  { date: "Jul 12, 2026 8:00 AM", fuel: "AdBlue (10L)", oldPrice: 200, newPrice: 180, changedBy: "System", reason: "Supplier Update" },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  { id: "AUD-3021", time: "Jul 17, 2026 10:15 AM", user: "John Kamau", action: "Created user", target: "David Kimani", ip: "192.168.10.14", severity: "info" },
  { id: "AUD-3020", time: "Jul 17, 2026 09:42 AM", user: "Grace Wanjiku", action: "Updated role", target: "Grace Wanjiku \u2192 Manager", ip: "192.168.10.02", severity: "info" },
  { id: "AUD-3019", time: "Jul 17, 2026 09:12 AM", user: "Unknown", action: "Failed login (3 attempts)", target: "Cashier account", ip: "41.90.64.201", severity: "danger" },
  { id: "AUD-3018", time: "Jul 16, 2026 04:20 PM", user: "Peter Mwangi", action: "Updated user", target: "Peter Mwangi profile", ip: "192.168.10.09", severity: "info" },
  { id: "AUD-3017", time: "Jul 16, 2026 03:45 PM", user: "John Kamau", action: "Changed fuel price", target: "Diesel (ENS90) \u2192 1,295 KES/L", ip: "192.168.10.14", severity: "warning" },
  { id: "AUD-3016", time: "Jul 16, 2026 02:30 PM", user: "Amina Juma", action: "Created user", target: "Amina Juma", ip: "192.168.10.05", severity: "info" },
  { id: "AUD-3015", time: "Jul 16, 2026 11:05 AM", user: "System", action: "Auto backup completed", target: "Database snapshot", ip: "internal", severity: "info" },
  { id: "AUD-3014", time: "Jul 15, 2026 08:50 PM", user: "Joseph Mburu", action: "Suspended user", target: "Joseph Mburu (self)", ip: "192.168.10.11", severity: "danger" },
  { id: "AUD-3013", time: "Jul 15, 2026 06:15 PM", user: "System", action: "Controller reconnected", target: "C-004 \u2013 Kibaha STN-004", ip: "internal", severity: "warning" },
  { id: "AUD-3012", time: "Jul 15, 2026 01:20 PM", user: "David Kimani", action: "Voided transaction", target: "Receipt #00001198", ip: "192.168.10.07", severity: "warning" },
];

export const INITIAL_ALERTS: AlertRow[] = [
  { id: "ALT-1042", module: "Fuel Tanks", message: "Water detected in Tank 3", severity: "danger", status: "Active", time: "10 mins ago" },
  { id: "ALT-1041", module: "Fuel Tanks", message: "Low level warning \u2013 Tank 5", severity: "warning", status: "Active", time: "15 mins ago" },
  { id: "ALT-1040", module: "Tank Gauges", message: "ATG communication lost \u2013 Tank 8", severity: "warning", status: "Acknowledged", time: "30 mins ago" },
  { id: "ALT-1039", module: "Controllers", message: "Controller C-004 offline since 10:16 AM", severity: "danger", status: "Active", time: "2 hrs ago" },
  { id: "ALT-1038", module: "Fleet Accounts", message: "Soko Express Ltd is over credit limit", severity: "warning", status: "Active", time: "3 hrs ago" },
  { id: "ALT-1037", module: "Cash Management", message: "Cash on hand below threshold at Kisutu", severity: "warning", status: "Acknowledged", time: "4 hrs ago" },
  { id: "ALT-1036", module: "Inventory", message: "Windshield Washer Fluid out of stock", severity: "danger", status: "Active", time: "5 hrs ago" },
  { id: "ALT-1035", module: "Maintenance", message: "Generator - Full Service due in 1 day", severity: "info", status: "Active", time: "6 hrs ago" },
  { id: "ALT-1034", module: "Price Management", message: "Low margin alert \u2013 Kerosene", severity: "warning", status: "Resolved", time: "1 day ago" },
  { id: "ALT-1033", module: "Dispensers", message: "Pump 4 offline", severity: "danger", status: "Resolved", time: "1 day ago" },
];

export const STATION_FINANCE: StationFinance[] = [
  { station: "Kariakoo Service Station", revenue: 720000, expenses: 486000, profit: 234000 },
  { station: "Mbagala Service Station", revenue: 480000, expenses: 337000, profit: 143000 },
  { station: "Temeke Service Station", revenue: 390000, expenses: 279000, profit: 111000 },
  { station: "Kisutu Service Station", revenue: 310000, expenses: 231000, profit: 79000 },
  { station: "Upanga Service Station", revenue: 210000, expenses: 162000, profit: 48000 },
];

export const FINANCE_TREND = [
  { d: "Jul 11", revenue: 380000, expenses: 274000 }, { d: "Jul 12", revenue: 410000, expenses: 292000 },
  { d: "Jul 13", revenue: 355000, expenses: 258000 }, { d: "Jul 14", revenue: 470000, expenses: 336000 },
  { d: "Jul 15", revenue: 505000, expenses: 358000 }, { d: "Jul 16", revenue: 520000, expenses: 366000 },
  { d: "Jul 17", revenue: 482600, expenses: 342000 },
];

export const EXPENSE_BREAKDOWN = [
  { name: "Fuel Purchases", value: 1820000, color: "#17c964" },
  { name: "Payroll", value: 340000, color: "#38bdf8" },
  { name: "Maintenance", value: 124560, color: "#f5a524" },
  { name: "Utilities", value: 86000, color: "#a78bfa" },
  { name: "Other", value: 52000, color: "#8b98a5" },
];

export const AP_AR = [
  { label: "Accounts Receivable (Fleet)", value: 645230, tone: "warning" as const },
  { label: "Accounts Payable (Suppliers)", value: 890400, tone: "danger" as const },
];
