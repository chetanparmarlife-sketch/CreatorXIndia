import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Brand } from "@creatorx/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient, uploadToPresignedUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Step = 1 | 2 | 3;

export default function BrandOnboardingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [gstin, setGstin] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const { data: profileData } = useQuery<{ brand: Brand }>({
    queryKey: ["/api/brand/profile"],
  });

  useEffect(() => {
    if (!profileData?.brand) return;
    setCompanyName((current) => current || profileData.brand.name || "");
    setIndustry((current) => current || profileData.brand.industry || "");
    setWebsiteUrl((current) => current || profileData.brand.website || "");
    setLogoUrl((current) => current || profileData.brand.logo_url || "");
  }, [profileData]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!logoFile || !user?.id) {
        throw new Error("Select a logo file first");
      }

      const presignRes = await apiRequest("POST", "/api/uploads/presign", {
        type: "avatar",
        filename: logoFile.name,
      });

      const { uploadUrl, publicUrl } = (await presignRes.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      await uploadToPresignedUrl(uploadUrl, logoFile, logoFile.type || "application/octet-stream");
      return publicUrl;
    },
    onSuccess: (publicUrl) => {
      setLogoUrl(publicUrl);
      toast({ title: "Logo uploaded" });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast({ title: "Could not upload logo", description: message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/brand/profile", {
        companyName,
        industry,
        websiteUrl,
        gstin: gstin || undefined,
        logoUrl: logoUrl || undefined,
      });
      return res.json() as Promise<{ brand: Brand }>;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/brand/profile"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/brand/dashboard-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/brand/activity"] }),
      ]);
      navigate("/dashboard");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not complete onboarding";
      toast({ title: "Onboarding failed", description: message, variant: "destructive" });
    },
  });

  const canMoveFromStepOne = useMemo(
    () => companyName.trim().length > 0 && industry.trim().length > 0 && websiteUrl.trim().length > 0,
    [companyName, industry, websiteUrl],
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-2xl bg-card border border-border rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Brand onboarding</h1>
          <span className="text-sm text-muted-foreground">Step {step} of 3</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                data-testid="input-company-name"
              />
            </div>

            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                data-testid="input-industry"
              />
            </div>

            <div>
              <Label htmlFor="website-url">Website URL</Label>
              <Input
                id="website-url"
                type="url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                data-testid="input-website-url"
              />
            </div>

            <div>
              <Label htmlFor="gstin">GSTIN (optional)</Label>
              <Input
                id="gstin"
                value={gstin}
                onChange={(event) => setGstin(event.target.value.toUpperCase())}
                data-testid="input-gstin"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canMoveFromStepOne}
                data-testid="btn-next-step-1"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="logo-file">Company logo</Label>
              <Input
                id="logo-file"
                type="file"
                accept="image/*"
                onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                data-testid="input-logo-file"
              />
            </div>

            {logoUrl && (
              <div className="rounded-xl border border-border p-4">
                <img src={logoUrl} alt="Brand logo preview" className="h-16 w-16 object-cover rounded-lg" />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => uploadMutation.mutate()}
                disabled={!logoFile || uploadMutation.isPending}
                data-testid="btn-upload-logo"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload logo"}
              </Button>

              <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="btn-back-step-2">
                Back
              </Button>

              <Button type="button" onClick={() => setStep(3)} data-testid="btn-next-step-2">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
              <div><span className="text-muted-foreground">Company:</span> {companyName}</div>
              <div><span className="text-muted-foreground">Industry:</span> {industry}</div>
              <div><span className="text-muted-foreground">Website:</span> {websiteUrl}</div>
              <div><span className="text-muted-foreground">GSTIN:</span> {gstin || "Not provided"}</div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="btn-back-step-3">
                Back
              </Button>
              <Button
                type="button"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                data-testid="btn-complete-onboarding"
              >
                {completeMutation.isPending ? "Completing..." : "Complete onboarding"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
