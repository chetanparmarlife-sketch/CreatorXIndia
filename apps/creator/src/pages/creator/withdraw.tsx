import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreatorShell, CreatorSubHeader } from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtMoney } from "@/lib/format";
import { cn, getErrorMessage } from "@/lib/utils";

type Earnings = {
  balance_cents: number;
  kyc_status: string;
  has_upi: boolean;
  has_bank: boolean;
  fy_earned_cents: number;
};

type Payout = {
  upi_id: string | null;
  bank_account_number_last4: string | null;
  bank_ifsc: string | null;
};

type Preview = {
  gross_cents: number;
  tds_cents: number;
  gst_cents: number;
  net_cents: number;
  has_gstin: boolean;
  has_pan: boolean;
  tds_rate: number;
  fy_earned_cents: number;
  threshold_cents: number;
  upi_limit_cents: number;
  suggested_method: "upi" | "bank";
};

export default function WithdrawPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState<"upi" | "bank" | null>(null);

  const { data: earnings } = useQuery<Earnings>({ queryKey: ["/api/earnings"] });
  const { data: payout } = useQuery<Payout>({ queryKey: ["/api/payout-instruments"] });

  const balance = earnings?.balance_cents || 0;
  const kyc = earnings?.kyc_status || "none";
  const amountRupees = parseFloat(amount || "0");
  const amountPaise = Math.round(amountRupees * 100);
  const exceedsBalance = amountPaise > balance;
  const zero = amountPaise === 0;
  const belowMin = amountPaise > 0 && amountPaise < 50_000; // ₹500 min

  // Live preview of tax breakdown (debounced-ish; runs when amount valid)
  const { data: preview } = useQuery<Preview>({
    queryKey: ["/api/withdrawals/preview", amountPaise],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/withdrawals/preview", { amount_cents: amountPaise });
      return await res.json();
    },
    enabled: amountPaise >= 50_000 && amountPaise <= balance,
  });

  // Auto-pick method based on suggestion once available
  if (method === null && preview?.suggested_method) {
    setMethod(preview.suggested_method);
  }

  const withdrawMut = useMutation({
    mutationFn: async () => {
      if (!method) throw new Error("Choose a payout method");
      const res = await apiRequest("POST", "/api/withdrawals", { amount_cents: amountPaise, method });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Withdrawal requested", description: "Admin will release your payout within 1–3 business days." });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      setLocation("/earnings");
    },
    onError: (e: unknown) => {
      toast({ title: "Withdrawal failed", description: getErrorMessage(e) || "Please try again.", variant: "destructive" });
    },
  });

  function press(key: string) {
    if (key === "back") { setAmount((a) => (a.length > 1 ? a.slice(0, -1) : "0")); return; }
    if (key === ".") { if (amount.includes(".")) return; setAmount(amount + "."); return; }
    if (amount === "0") setAmount(key);
    else if (amount.split(".")[1]?.length >= 2) return;
    else setAmount(amount + key);
  }

  const upiBlocked = method === "upi" && preview && preview.gross_cents > preview.upi_limit_cents;
  const kycBlocked = kyc !== "verified";
  const methodMissing = (method === "upi" && !earnings?.has_upi) || (method === "bank" && !earnings?.has_bank);

  const canSubmit = !exceedsBalance && !zero && !belowMin && !withdrawMut.isPending && !kycBlocked && !methodMissing && !upiBlocked && !!method;

  return (
    <CreatorShell>
      <CreatorSubHeader
        title="Withdraw"
        subtitle={`Balance ${fmtMoney(balance)}`}
        backHref="/earnings"
      />

      <div className="px-5 pt-1 pb-4 flex flex-col">
        {/* KYC gate */}
        {kycBlocked && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4" data-testid="alert-kyc">
            <div className="flex items-start gap-3">
              <Icon name="shield" filled className="text-amber-300 text-[22px] mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">Complete KYC to withdraw</div>
                <div className="text-xs text-muted-foreground mt-0.5">PAN verification is required by Indian tax law (Sec 194R) before any payout.</div>
                <Button size="sm" variant="secondary" onClick={() => setLocation("/settings")} className="mt-2 rounded-full">Go to KYC</Button>
              </div>
            </div>
          </div>
        )}

        {/* Amount display */}
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Withdraw amount (INR)</div>
          <div className="flex items-start gap-1">
            <span className="text-3xl font-black text-muted-foreground mt-3">₹</span>
            <span className={cn("text-7xl font-black tracking-tight tabular-nums", exceedsBalance && "text-red-400")} data-testid="text-amount">
              {amount}
            </span>
          </div>
          {exceedsBalance && <div className="mt-2 text-sm text-red-400 font-semibold">Exceeds available balance</div>}
          {belowMin && <div className="mt-2 text-sm text-amber-400 font-semibold">Minimum withdrawal is ₹500</div>}
          <div className="flex gap-2 mt-5">
            {[25, 50, 100].map((pct) => {
              const rupees = Math.floor(balance * (pct / 100)) / 100;
              return (
                <button key={pct} onClick={() => setAmount(rupees.toFixed(0))} className="px-3 py-1.5 rounded-full bg-card border border-border text-xs font-bold hover-elevate" data-testid={`preset-${pct}`}>
                  {pct === 100 ? "Max" : `${pct}%`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tax preview */}
        {preview && !exceedsBalance && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-4" data-testid="panel-preview">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Tax breakdown</div>
            <Row label="Gross earning" value={fmtMoney(preview.gross_cents)} bold />
            {preview.tds_cents > 0 ? (
              <Row label={`TDS (${preview.has_pan ? "10%" : "20% — PAN missing"} · Sec 194R)`} value={`− ${fmtMoney(preview.tds_cents)}`} negative />
            ) : (
              <Row label={`TDS (FY earnings below ₹${(preview.threshold_cents / 100).toLocaleString("en-IN")} threshold)`} value="₹0" muted />
            )}
            {preview.has_gstin && <Row label="GST (18% — on your invoice)" value={`+ ${fmtMoney(preview.gst_cents)}`} positive />}
            <div className="border-t border-border my-2" />
            <Row label="Net to you" value={fmtMoney(preview.net_cents)} bold big />
            <div className="text-[11px] text-muted-foreground mt-2">FY earned so far: {fmtMoney(preview.fy_earned_cents)} · After this: {fmtMoney(preview.fy_earned_cents + preview.gross_cents)}</div>
          </div>
        )}

        {/* Method selector */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Payout to</div>
          <div className="space-y-1.5">
            <MethodOption
              id="upi"
              active={method === "upi"}
              onClick={() => setMethod("upi")}
              icon="send_money"
              label="UPI"
              sub={payout?.upi_id || "Not configured — add UPI in Settings"}
              disabled={!earnings?.has_upi}
              warning={upiBlocked ? "Exceeds ₹1,00,000 UPI limit — use bank" : null}
            />
            <MethodOption
              id="bank"
              active={method === "bank"}
              onClick={() => setMethod("bank")}
              icon="account_balance"
              label="Bank (IMPS/NEFT)"
              sub={payout?.bank_ifsc ? `${payout.bank_ifsc} ••••${payout.bank_account_number_last4}` : "Not configured — add bank in Settings"}
              disabled={!earnings?.has_bank}
            />
          </div>
          {methodMissing && (
            <div className="text-xs text-red-400 mt-2 font-semibold">This method isn't configured. <button onClick={() => setLocation("/settings")} className="underline">Open settings</button></div>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((k) => (
            <button key={k} onClick={() => press(k)} className="h-14 rounded-2xl bg-card border border-border text-2xl font-bold hover-elevate flex items-center justify-center" data-testid={`key-${k}`}>
              {k === "back" ? <Icon name="backspace" className="text-[22px]" /> : k}
            </button>
          ))}
        </div>

        <Button
          onClick={() => withdrawMut.mutate()}
          disabled={!canSubmit}
          className="w-full h-14 rounded-2xl font-bold uppercase tracking-widest glow-primary disabled:opacity-40"
          data-testid="button-confirm-withdraw"
        >
          {withdrawMut.isPending ? "Processing…" : preview ? `Withdraw · Get ${fmtMoney(preview.net_cents)}` : `Withdraw ${fmtMoney(amountPaise)}`}
        </Button>
      </div>
    </CreatorShell>
  );
}

function Row({ label, value, bold, big, negative, positive, muted }: {
  label: string; value: string; bold?: boolean; big?: boolean; negative?: boolean; positive?: boolean; muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={cn("text-xs", muted ? "text-muted-foreground" : "text-foreground", bold && "font-bold", big && "text-sm")}>{label}</span>
      <span className={cn("tabular-nums", negative && "text-red-400", positive && "text-green-400", muted && "text-muted-foreground", bold && "font-bold", big ? "text-lg" : "text-sm")}>{value}</span>
    </div>
  );
}

function MethodOption({ id, active, onClick, icon, label, sub, disabled, warning }: {
  id: string; active: boolean; onClick: () => void; icon: string; label: string; sub: string; disabled?: boolean; warning?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-2xl border text-left hover-elevate disabled:opacity-50",
        active ? "bg-primary/10 border-primary" : "bg-card border-border"
      )}
      data-testid={`method-${id}`}
    >
      <div className={cn("size-10 rounded-xl flex items-center justify-center", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
        <Icon name={icon} filled className="text-[18px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{sub}</div>
        {warning && <div className="text-xs text-amber-400 font-semibold mt-0.5">{warning}</div>}
      </div>
      {active && <Icon name="check_circle" filled className="text-primary text-[20px]" />}
    </button>
  );
}
