import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SettingsSubShell } from "./_shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/brand";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isValidUPI, isValidIFSC } from "@shared/india";

type PayoutPayload = {
  upi_id: string | null;
  bank_account_number: string | null;
  bank_account_number_last4: string | null;
  bank_ifsc: string | null;
  bank_account_holder: string | null;
};

export default function SettingsPayoutsPage() {
  const { toast } = useToast();
  const { data: payout } = useQuery<PayoutPayload>({ queryKey: ["/api/payout-instruments"] });

  const [upi, setUpi] = useState("");
  const [bankAcct, setBankAcct] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankHolder, setBankHolder] = useState("");

  useEffect(() => {
    if (payout) {
      setUpi(payout.upi_id || "");
      setIfsc(payout.bank_ifsc || "");
      setBankHolder(payout.bank_account_holder || "");
    }
  }, [payout]);

  const upiMut = useMutation({
    mutationFn: async () => {
      if (!isValidUPI(upi)) throw new Error("Invalid UPI ID. Format: yourname@bank");
      const res = await apiRequest("POST", "/api/payout-instruments", { upi_id: upi });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "UPI saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/payout-instruments"] });
    },
    onError: (e: any) => toast({ title: "Couldn't save UPI", description: e?.message, variant: "destructive" }),
  });

  const bankMut = useMutation({
    mutationFn: async () => {
      if (!bankAcct || bankAcct.length < 6) throw new Error("Enter your full bank account number");
      if (!isValidIFSC(ifsc)) throw new Error("Invalid IFSC. Format: ABCD0123456");
      if (!bankHolder.trim()) throw new Error("Account holder name is required");
      const res = await apiRequest("POST", "/api/payout-instruments", {
        bank_account_number: bankAcct,
        bank_ifsc: ifsc.toUpperCase(),
        bank_account_holder: bankHolder.trim(),
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Bank details saved" });
      setBankAcct("");
      queryClient.invalidateQueries({ queryKey: ["/api/payout-instruments"] });
    },
    onError: (e: any) => toast({ title: "Couldn't save bank", description: e?.message, variant: "destructive" }),
  });

  return (
    <SettingsSubShell title="Payout methods" subtitle="Where you want to receive earnings">
      <div className="space-y-5">
        {/* UPI card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Icon name="flash_on" filled className="text-primary text-[20px]" />
            </div>
            <div className="flex-1">
              <div className="font-bold">UPI</div>
              <div className="text-xs text-muted-foreground">Instant · Up to ₹1,00,000 per payout</div>
            </div>
            {payout?.upi_id && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-green-400 bg-green-500/15 px-2 py-1 rounded-full">
                Saved
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            <Field label="UPI ID">
              <Input
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                placeholder="yourname@oksbi"
                className="bg-background border-border h-11 rounded-xl font-mono"
                data-testid="input-upi"
              />
            </Field>
            <Button
              onClick={() => upiMut.mutate()}
              disabled={upiMut.isPending}
              className="w-full h-11 rounded-xl font-bold"
              data-testid="button-save-upi"
            >
              {upiMut.isPending ? "Saving..." : payout?.upi_id ? "Update UPI" : "Save UPI"}
            </Button>
          </div>
        </div>

        {/* Bank card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Icon name="account_balance" filled className="text-primary text-[20px]" />
            </div>
            <div className="flex-1">
              <div className="font-bold">Bank account</div>
              <div className="text-xs text-muted-foreground">IMPS/NEFT · Any amount · T+1 day</div>
            </div>
            {payout?.bank_ifsc && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-green-400 bg-green-500/15 px-2 py-1 rounded-full">
                Saved
              </span>
            )}
          </div>
          <div className="p-4 space-y-3">
            {payout?.bank_account_number_last4 && !bankAcct && (
              <div className="bg-background border border-border rounded-xl px-3 py-2 text-xs">
                <span className="text-muted-foreground">Current: </span>
                <span className="font-mono">••••{payout.bank_account_number_last4}</span>
                <span className="text-muted-foreground"> · {payout.bank_ifsc}</span>
              </div>
            )}
            <Field label="Account number">
              <Input
                value={bankAcct}
                onChange={(e) => setBankAcct(e.target.value.replace(/\D/g, ""))}
                placeholder={payout?.bank_account_number_last4 ? "Enter new account to update" : "Account number"}
                className="bg-background border-border h-11 rounded-xl font-mono"
                data-testid="input-bank-acct"
              />
            </Field>
            <Field label="IFSC code">
              <Input
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="HDFC0001234"
                maxLength={11}
                className="bg-background border-border h-11 rounded-xl font-mono tracking-wider"
                data-testid="input-ifsc"
              />
            </Field>
            <Field label="Account holder name">
              <Input
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
                placeholder="As per bank records"
                className="bg-background border-border h-11 rounded-xl"
                data-testid="input-bank-holder"
              />
            </Field>
            <Button
              onClick={() => bankMut.mutate()}
              disabled={bankMut.isPending}
              className="w-full h-11 rounded-xl font-bold"
              data-testid="button-save-bank"
            >
              {bankMut.isPending ? "Saving..." : payout?.bank_ifsc ? "Update bank details" : "Save bank details"}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-start gap-2.5">
            <Icon name="lock" filled className="text-muted-foreground text-[18px] mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              Your payout details are encrypted end-to-end. We store only the last 4 digits of your account number in plain text.
            </div>
          </div>
        </div>
      </div>
    </SettingsSubShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
