import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtMoney, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBrandContext } from "@/hooks/useBrandContext";

type WalletTransaction = {
  id: string;
  brand_id: string;
  type: "credit" | "debit";
  amount_paise: number;
  description: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
};

type Invoice = {
  id: string;
  brand_id: string;
  invoice_number: string;
  amount_paise: number;
  gst_paise: number;
  total_paise: number;
  pdf_url: string | null;
  issued_at: string;
  created_at: string;
};

type WalletSummaryResponse = {
  balancePaise: number;
  transactions: WalletTransaction[];
};

type WalletTopupResponse = {
  orderId: string;
  amount: number;
  currency: "INR";
  keyId: string;
};

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function typeBadgeClass(type: WalletTransaction["type"]): string {
  return type === "credit" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-600";
}

function statusBadgeClass(status: WalletTransaction["status"]): string {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-500";
  if (status === "failed") return "bg-red-500/15 text-red-500";
  return "bg-slate-500/15 text-slate-500";
}

export default function WalletPage() {
  const { brandId } = useBrandContext();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [topupAmountRupees, setTopupAmountRupees] = useState("1000");

  const { data: walletData, isLoading: walletLoading } = useQuery<WalletSummaryResponse>({
    queryKey: ["brand", brandId, "wallet"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/brand/wallet");
      return res.json() as Promise<WalletSummaryResponse>;
    },
  });

  const { data: invoiceData, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["brand", brandId, "invoices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/brand/invoices");
      return res.json() as Promise<{ invoices: Invoice[] }>;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (payload: RazorpayCheckoutResponse) => {
      const res = await apiRequest("POST", "/api/brand/wallet/verify", payload);
      return res.json() as Promise<{ success: true; newBalancePaise: number; invoiceNumber: string }>;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "invoices"] }),
      ]);
      setIsDialogOpen(false);
      toast({ title: "Wallet top-up successful" });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not verify payment";
      toast({ title: "Verification failed", description: message, variant: "destructive" });
    },
  });

  const topupMutation = useMutation({
    mutationFn: async () => {
      const amountRupees = Number(topupAmountRupees);
      const amountPaise = Math.round(amountRupees * 100);
      const res = await apiRequest("POST", "/api/brand/wallet/topup", { amountPaise });
      return res.json() as Promise<WalletTopupResponse>;
    },
    onSuccess: async (data) => {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        toast({ title: "Razorpay failed to load", variant: "destructive" });
        return;
      }

      const options: RazorpayCheckoutOptions = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "CreatorX",
        description: "Wallet Top-up",
        order_id: data.orderId,
        handler: (response) => {
          verifyMutation.mutate(response);
        },
        theme: {
          color: "#2563eb",
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.open();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not create top-up order";
      toast({ title: "Top-up failed", description: message, variant: "destructive" });
    },
  });

  const amountValidationMessage = useMemo(() => {
    const amountRupees = Number(topupAmountRupees);
    if (!Number.isFinite(amountRupees)) return "Enter a valid amount";
    if (amountRupees < 1000) return "Minimum amount is ₹1000";
    if (amountRupees > 100000) return "UPI limit is ₹1,00,000";
    return "";
  }, [topupAmountRupees]);

  const isTopupDisabled = topupMutation.isPending || verifyMutation.isPending || Boolean(amountValidationMessage);
  const balancePaise = walletData?.balancePaise ?? 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Current Wallet Balance</div>
              <div className="mt-1 text-3xl font-bold" data-testid="wallet-balance">
                {fmtMoney(balancePaise)}
              </div>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="btn-topup">
              Top Up
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-semibold mb-4">Transactions</h2>
          <div className="space-y-3">
            {walletLoading && <div className="text-sm text-muted-foreground">Loading transactions...</div>}
            {!walletLoading && (walletData?.transactions ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">No wallet transactions yet.</div>
            )}
            {(walletData?.transactions ?? []).map((transaction) => (
              <div
                key={transaction.id}
                className="grid gap-2 rounded-xl border border-border p-4 md:grid-cols-5 md:items-center"
                data-testid={`transaction-row-${transaction.id}`}
              >
                <span className={cn("inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", typeBadgeClass(transaction.type))}>
                  {transaction.type}
                </span>
                <div className="font-semibold">{fmtMoney(transaction.amount_paise)}</div>
                <div className="text-sm text-muted-foreground">{transaction.description}</div>
                <span className={cn("inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", statusBadgeClass(transaction.status))}>
                  {transaction.status}
                </span>
                <div className="text-sm text-muted-foreground">{fmtDate(transaction.created_at)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-semibold mb-4">Invoices</h2>
          <div className="space-y-3">
            {invoicesLoading && <div className="text-sm text-muted-foreground">Loading invoices...</div>}
            {!invoicesLoading && (invoiceData?.invoices ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">No invoices yet.</div>
            )}
            {(invoiceData?.invoices ?? []).map((invoice) => (
              <div
                key={invoice.id}
                className="grid gap-2 rounded-xl border border-border p-4 md:grid-cols-4 md:items-center"
                data-testid={`invoice-row-${invoice.id}`}
              >
                <div className="font-semibold">{invoice.invoice_number}</div>
                <div>{fmtMoney(invoice.total_paise)}</div>
                <div className="text-sm text-muted-foreground">{fmtDate(invoice.issued_at)}</div>
                {invoice.pdf_url ? (
                  <a
                    href={invoice.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary underline"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Download unavailable</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold">Top Up Wallet</h3>
            <div className="mt-4 space-y-3">
              <label htmlFor="topup-amount" className="text-sm text-muted-foreground">
                Amount (₹)
              </label>
              <Input
                id="topup-amount"
                type="number"
                min={1000}
                max={100000}
                value={topupAmountRupees}
                onChange={(event) => setTopupAmountRupees(event.target.value)}
                data-testid="input-topup-amount"
              />
              {amountValidationMessage && <p className="text-sm text-red-500">{amountValidationMessage}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => topupMutation.mutate()}
                  disabled={isTopupDisabled}
                  data-testid="btn-pay-razorpay"
                >
                  {topupMutation.isPending || verifyMutation.isPending ? "Processing..." : "Pay with Razorpay"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
