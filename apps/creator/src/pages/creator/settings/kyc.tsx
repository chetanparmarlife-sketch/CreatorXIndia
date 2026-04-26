import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SettingsSubShell } from "./_shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn, getErrorMessage } from "@/lib/utils";
import { isValidPAN, isValidGSTIN, isValidAadhaarLast4 } from "@creatorx/schema/india";

type KycPayload = {
  kyc_status: string;
  pan_number: string | null;
  pan_name: string | null;
  aadhaar_last4: string | null;
  gstin: string | null;
  kyc_rejection_reason: string | null;
};

export default function SettingsKycPage() {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const { data: kyc } = useQuery<KycPayload>({ queryKey: ["/api/kyc"] });

  const [pan, setPan] = useState("");
  const [panName, setPanName] = useState("");
  const [aadhaar4, setAadhaar4] = useState("");
  const [gstin, setGstin] = useState("");

  useEffect(() => {
    if (kyc) {
      setPan(kyc.pan_number || "");
      setPanName(kyc.pan_name || "");
      setAadhaar4(kyc.aadhaar_last4 || "");
      setGstin(kyc.gstin || "");
    }
  }, [kyc]);

  const kycMut = useMutation({
    mutationFn: async () => {
      if (!isValidPAN(pan)) throw new Error("Invalid PAN. Format: ABCDE1234F");
      if (!panName.trim()) throw new Error("Name as on PAN is required");
      if (aadhaar4 && !isValidAadhaarLast4(aadhaar4)) throw new Error("Aadhaar must be last 4 digits");
      if (gstin && !isValidGSTIN(gstin)) throw new Error("Invalid GSTIN format");
      const res = await apiRequest("POST", "/api/kyc", {
        pan_number: pan.toUpperCase(),
        pan_name: panName.trim(),
        aadhaar_last4: aadhaar4 || null,
        gstin: gstin ? gstin.toUpperCase() : null,
      });
      return await res.json();
    },
    onSuccess: async () => {
      toast({ title: "KYC submitted", description: "Our team will review within 24 hours." });
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["/api/kyc"] });
    },
    onError: (e: unknown) =>
      toast({ title: "KYC failed", description: getErrorMessage(e) || "Please check your details.", variant: "destructive" }),
  });

  const kycStatus = kyc?.kyc_status || "none";
  const verified = kycStatus === "verified";

  return (
    <SettingsSubShell
      title="KYC & Tax"
      subtitle="Required for payouts and tax compliance"
      trailing={<StatusPill status={kycStatus} />}
    >
      <div className="space-y-5">
        {/* Status banner */}
        <StatusBanner status={kycStatus} reason={kyc?.kyc_rejection_reason || null} />

        <div className="space-y-4">
          <Field label="PAN number" required>
            <Input
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
              className="bg-card border-border h-12 rounded-xl font-mono tracking-wider"
              disabled={verified}
              data-testid="input-pan"
            />
          </Field>

          <Field label="Name as on PAN" required>
            <Input
              value={panName}
              onChange={(e) => setPanName(e.target.value)}
              placeholder="Exactly as printed on PAN card"
              className="bg-card border-border h-12 rounded-xl"
              disabled={verified}
              data-testid="input-pan-name"
            />
          </Field>

          <Field label="Aadhaar last 4" hint="Optional — helps verify faster">
            <Input
              value={aadhaar4}
              onChange={(e) => setAadhaar4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              maxLength={4}
              className="bg-card border-border h-12 rounded-xl font-mono"
              disabled={verified}
              data-testid="input-aadhaar"
            />
          </Field>

          <Field label="GSTIN" hint="Optional — for 18% GST invoices">
            <Input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              className="bg-card border-border h-12 rounded-xl font-mono tracking-wider"
              disabled={verified}
              data-testid="input-gstin"
            />
          </Field>
        </div>

        {!verified && (
          <Button
            onClick={() => kycMut.mutate()}
            disabled={kycMut.isPending}
            className="w-full h-12 rounded-xl font-bold glow-primary"
            data-testid="button-submit-kyc"
          >
            {kycMut.isPending
              ? "Submitting..."
              : kycStatus === "pending"
              ? "Re-submit KYC"
              : kycStatus === "rejected"
              ? "Re-submit KYC"
              : "Submit KYC for verification"}
          </Button>
        )}

        <InfoCard>
          <div className="font-bold text-sm mb-2">Why do we need this?</div>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>PAN is mandatory under Section 194R for TDS deduction (10%).</li>
            <li>Without PAN, TDS is 20% and withdrawals are limited.</li>
            <li>GSTIN lets you invoice the 18% GST separately.</li>
            <li>Your details are encrypted and never shared with brands.</li>
          </ul>
        </InfoCard>
      </div>
    </SettingsSubShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    none: { label: "Not submitted", cls: "bg-muted text-muted-foreground" },
    pending: { label: "Review", cls: "bg-amber-500/15 text-amber-300" },
    verified: { label: "Verified", cls: "bg-green-500/15 text-green-400" },
    rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-400" },
  };
  const m = map[status] || map.none;
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex-shrink-0", m.cls)}>
      {m.label}
    </span>
  );
}

function StatusBanner({ status, reason }: { status: string; reason: string | null }) {
  if (status === "verified") {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-start gap-3">
        <Icon name="verified" filled className="text-green-400 text-[22px] flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm text-green-300">KYC verified</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Your identity is verified. Withdrawals unlocked.
          </div>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
        <Icon name="schedule" filled className="text-amber-300 text-[22px] flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm text-amber-200">Under review</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Usually decided within 24 hours. We'll notify you.
          </div>
        </div>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
        <Icon name="error" filled className="text-red-400 text-[22px] flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm text-red-300">KYC rejected</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {reason || "Please correct your details and submit again."}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
      <Icon name="info" filled className="text-primary text-[22px] flex-shrink-0 mt-0.5" />
      <div>
        <div className="font-bold text-sm">Complete KYC to get paid</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Takes 2 minutes. You'll need your PAN card ready.
        </div>
      </div>
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-card border border-border rounded-2xl p-4">{children}</div>;
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-bold text-muted-foreground">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
