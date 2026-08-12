import { createPortal } from "react-dom";
import { Printer, X, CheckCircle2 } from "lucide-react";
import { kes } from "../lib/format";

export interface ReceiptData {
  receiptNo: string;
  receipts: string[];
  items: { product: string; litres: number; price: number; amount: number }[];
  totalAmount: number;
  paymentMethod: string;
  fleetAccount?: { accountId: string; name: string; balanceKes: number; status: string } | null;
  loyaltyMember?: { id: string; name: string; pointsEarned: number; pointsBalance: number } | null;
  cashier: string;
  station: string;
  createdAt: string;
}

export default function Receipt({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const subtotal = data.totalAmount / 1.16;
  const tax = data.totalAmount - subtotal;
  const date = new Date(data.createdAt);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:static print:inset-auto">
      <div className="absolute inset-0 bg-black/60 print:hidden" onClick={onClose} />
      <div className="relative card w-full max-w-[380px] max-h-[90vh] overflow-y-auto print:card print:max-w-none print:max-h-none print:border-0 print:shadow-none">
        <div className="flex items-center justify-between px-5 pt-5 print:hidden">
          <span className="flex items-center gap-2 text-success text-[13px] font-medium">
            <CheckCircle2 size={16} /> Sale Completed
          </span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg grid place-items-center text-text-dim hover:bg-white/5">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 font-mono-num text-[12px] leading-relaxed">
          <div className="text-center mb-4">
            <div className="text-[15px] font-semibold font-sans">{data.station}</div>
            <div className="text-text-faint text-[10.5px] font-sans">Fuel &amp; Retail Sales Receipt</div>
          </div>

          <div className="border-t border-dashed border-border pt-2.5 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-text-faint">Receipt #</span>
              <span>{data.receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-faint">Date</span>
              <span>{date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-faint">Cashier</span>
              <span>{data.cashier}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border mt-2.5 pt-2.5">
            {data.items.map((item, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span className="font-sans">
                  {item.product} <span className="text-text-faint">&times;{item.litres.toFixed(2)}L</span>
                </span>
                <span>{kes(item.amount)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-border mt-2.5 pt-2.5 space-y-1">
            <div className="flex justify-between text-text-dim">
              <span className="font-sans">Subtotal</span>
              <span>{kes(subtotal)}</span>
            </div>
            <div className="flex justify-between text-text-dim">
              <span className="font-sans">VAT (16%)</span>
              <span>{kes(tax)}</span>
            </div>
            <div className="flex justify-between text-[14px] font-semibold pt-1">
              <span className="font-sans">Total</span>
              <span>{kes(data.totalAmount)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-border mt-2.5 pt-2.5">
            <div className="flex justify-between">
              <span className="text-text-faint font-sans">Payment Method</span>
              <span>{data.paymentMethod}</span>
            </div>
            {data.fleetAccount && (
              <div className="flex justify-between">
                <span className="text-text-faint font-sans">Fleet Account</span>
                <span>{data.fleetAccount.accountId}</span>
              </div>
            )}
            {data.loyaltyMember && (
              <>
                <div className="flex justify-between">
                  <span className="text-text-faint font-sans">Loyalty Member</span>
                  <span>{data.loyaltyMember.name}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span className="font-sans">Points Earned</span>
                  <span>
                    +{data.loyaltyMember.pointsEarned} ({data.loyaltyMember.pointsBalance} total)
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="text-center text-text-faint text-[10.5px] font-sans mt-4 pt-3 border-t border-dashed border-border">
            Thank you for fueling with us!
          </div>
        </div>

        <div className="px-5 pb-5 flex items-center gap-2.5 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-lg bg-accent text-bg font-medium text-[12.5px] flex items-center justify-center gap-1.5"
          >
            <Printer size={14} /> Print Receipt
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-border text-text-dim text-[12.5px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}