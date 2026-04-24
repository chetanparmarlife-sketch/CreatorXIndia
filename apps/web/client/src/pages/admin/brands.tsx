import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Brand } from "@creatorx/schema";

export default function AdminBrandsPage() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Brand | null>(null);
  const [creating, setCreating] = useState(false);

  const { data } = useQuery<{ brands: Brand[] }>({ queryKey: ["/api/admin/brands"] });

  const saveMut = useMutation({
    mutationFn: async (b: Partial<Brand>) => {
      if (editing) {
        await apiRequest("PATCH", `/api/admin/brands/${editing.id}`, b);
      } else {
        await apiRequest("POST", "/api/admin/brands", b);
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Brand updated" : "Brand created" });
      setEditing(null);
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/brands/${id}`),
    onSuccess: () => {
      toast({ title: "Brand deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brands"] });
    },
  });

  const brands = (data?.brands || []).filter((b) =>
    !q || b.name.toLowerCase().includes(q.toLowerCase()) || b.industry.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AdminShell
      title="Brands"
      subtitle={`${brands.length} brand${brands.length === 1 ? "" : "s"}`}
      actions={
        <Button onClick={() => setCreating(true)} className="h-9 rounded-lg font-bold" data-testid="button-new-brand">
          <Icon name="add" className="text-[18px] mr-1" />
          New brand
        </Button>
      }
    >
      <div className="mb-5 max-w-md">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]" />
          <Input
            placeholder="Search brands..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 pl-10 bg-card border-border rounded-xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {brands.map((b) => (
          <div key={b.id} className="bg-card border border-border rounded-2xl p-5 hover-elevate">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-xl bg-white p-1.5 shrink-0">
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-primary">{b.name[0]}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="font-extrabold truncate">{b.name}</div>
                  {b.verified && <Icon name="verified" filled className="text-primary text-[14px]" />}
                </div>
                <div className="text-xs text-muted-foreground truncate">{b.industry}</div>
              </div>
            </div>
            {b.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{b.description}</p>}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <button
                onClick={() => setEditing(b)}
                className="flex-1 h-9 rounded-lg bg-muted text-sm font-bold hover-elevate"
                data-testid={`button-edit-${b.id}`}
              >
                Edit
              </button>
              <button
                onClick={() => { if (confirm(`Delete ${b.name}?`)) deleteMut.mutate(b.id); }}
                className="size-9 rounded-lg bg-red-500/10 text-red-400 font-bold hover-elevate flex items-center justify-center"
                data-testid={`button-delete-${b.id}`}
              >
                <Icon name="delete" className="text-[16px]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <BrandEditor
        open={creating || editing !== null}
        brand={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(b) => saveMut.mutate(b)}
        loading={saveMut.isPending}
      />
    </AdminShell>
  );
}

function BrandEditor({ open, brand, onClose, onSave, loading }: {
  open: boolean;
  brand: Brand | null;
  onClose: () => void;
  onSave: (b: Partial<Brand>) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(brand?.name || "");
  const [industry, setIndustry] = useState(brand?.industry || "");
  const [website, setWebsite] = useState(brand?.website || "");
  const [logo, setLogo] = useState(brand?.logo_url || "");
  const [description, setDescription] = useState(brand?.description || "");
  const [verified, setVerified] = useState(brand?.verified || false);

  // Reset form when brand changes
  if (open && brand && brand.name !== name && name === "") {
    setName(brand.name);
    setIndustry(brand.industry);
    setWebsite(brand.website || "");
    setLogo(brand.logo_url || "");
    setDescription(brand.description || "");
    setVerified(brand.verified);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>{brand ? "Edit brand" : "New brand"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FieldAdmin label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background border-border h-11" />
          </FieldAdmin>
          <FieldAdmin label="Industry">
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} className="bg-background border-border h-11" />
          </FieldAdmin>
          <FieldAdmin label="Website">
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="bg-background border-border h-11" />
          </FieldAdmin>
          <FieldAdmin label="Logo URL">
            <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." className="bg-background border-border h-11" />
          </FieldAdmin>
          <FieldAdmin label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="bg-background border-border resize-none" />
          </FieldAdmin>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-bold text-sm">Verified brand</div>
              <div className="text-xs text-muted-foreground">Appears with a verification badge</div>
            </div>
            <Switch checked={verified} onCheckedChange={setVerified} />
          </div>
          <Button
            onClick={() => onSave({ name, industry, website, logo_url: logo, description, verified })}
            disabled={loading || !name}
            className="w-full h-11 rounded-lg font-bold glow-primary"
            data-testid="button-save-brand"
          >
            {loading ? "Saving..." : brand ? "Save changes" : "Create brand"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldAdmin({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
