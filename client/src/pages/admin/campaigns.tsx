import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtMoney, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Campaign, Brand, CampaignStatus } from "@shared/schema";

type CampaignWithBrand = Campaign & { brand: Brand | null };

const STATUSES: (CampaignStatus | "all")[] = ["all", "open", "draft", "closed", "completed"];

export default function AdminCampaignsPage() {
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const [editing, setEditing] = useState<CampaignWithBrand | null>(null);
  const [creating, setCreating] = useState(false);

  const { data } = useQuery<{ campaigns: CampaignWithBrand[] }>({
    queryKey: ["/api/admin/campaigns"],
  });

  const { data: brandsData } = useQuery<{ brands: Brand[] }>({
    queryKey: ["/api/admin/brands"],
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Campaign> }) =>
      apiRequest("PATCH", `/api/admin/campaigns/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/campaigns/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] }),
  });

  const campaigns = (data?.campaigns || []).filter((c) => status === "all" || c.status === status);
  const brands = brandsData?.brands || [];

  return (
    <AdminShell
      title="Campaigns"
      subtitle={`${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}
      actions={
        <Button
          onClick={() => setCreating(true)}
          className="h-9 px-4 rounded-lg font-bold text-sm glow-primary"
          data-testid="button-new-campaign"
        >
          <Icon name="add" className="text-[18px] mr-1" />
          New campaign
        </Button>
      }
    >
      {/* Status filter */}
      <div className="flex gap-2 mb-5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              "h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-widest capitalize hover-elevate",
              status === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            )}
            data-testid={`filter-${s}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_160px_120px_140px_120px_100px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-muted-foreground border-b border-border">
          <div></div>
          <div>Campaign</div>
          <div>Brand</div>
          <div>Earning</div>
          <div>Slots</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>
        {campaigns.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No campaigns match</div>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="grid grid-cols-[80px_1fr_160px_120px_140px_120px_100px] gap-3 px-5 py-3 items-center border-b border-border last:border-b-0">
              <div className="size-14 rounded-xl overflow-hidden bg-muted">
                {c.cover_image_url && <img src={c.cover_image_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <button
                onClick={() => setEditing(c)}
                className="min-w-0 text-left hover-elevate -mx-2 px-2 py-1 rounded-lg"
                data-testid={`button-edit-${c.id}`}
              >
                <div className="font-bold text-sm truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground truncate">{c.category}</div>
              </button>
              <div className="text-sm font-semibold truncate">{c.brand?.name || "—"}</div>
              <div className="text-sm font-bold" style={{ color: "#6ea0ff" }}>{fmtMoney(c.base_earning_cents)}</div>
              <div className="text-sm">
                <span className="font-semibold">{c.slots_filled}</span>
                <span className="text-muted-foreground">/{c.slots_total}</span>
                <div className="text-[10px] text-muted-foreground">Apply by {fmtDate(c.apply_deadline)}</div>
              </div>
              <div>
                <select
                  value={c.status}
                  onChange={(e) => updateMut.mutate({ id: c.id, patch: { status: e.target.value as CampaignStatus } })}
                  className={cn(
                    "h-7 px-2 rounded-lg text-[10px] uppercase tracking-widest font-bold border-0 outline-none",
                    c.status === "open" ? "bg-primary/15 text-primary" :
                    c.status === "draft" ? "bg-muted text-muted-foreground" :
                    c.status === "closed" ? "bg-red-500/15 text-red-400" :
                    "bg-green-500/15 text-green-400"
                  )}
                  data-testid={`select-status-${c.id}`}
                >
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => { if (confirm(`Delete "${c.title}"?`)) deleteMut.mutate(c.id); }}
                  className="size-8 rounded-lg bg-red-500/10 text-red-400 hover-elevate flex items-center justify-center"
                  data-testid={`button-delete-${c.id}`}
                >
                  <Icon name="delete" className="text-[14px]" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {creating && (
        <CampaignDialog
          campaign={null}
          brands={brands}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <CampaignDialog
          campaign={editing}
          brands={brands}
          onClose={() => setEditing(null)}
        />
      )}
    </AdminShell>
  );
}

function CampaignDialog({
  campaign,
  brands,
  onClose,
}: {
  campaign: Campaign | null;
  brands: Brand[];
  onClose: () => void;
}) {
  const isEdit = !!campaign;
  const [title, setTitle] = useState(campaign?.title || "");
  const [brandId, setBrandId] = useState(campaign?.brand_id || brands[0]?.id || "");
  const [category, setCategory] = useState(campaign?.category || "Beauty");
  const [description, setDescription] = useState(campaign?.description || "");
  const [coverImage, setCoverImage] = useState(campaign?.cover_image_url || "");
  const [baseEarning, setBaseEarning] = useState(
    campaign ? (campaign.base_earning_cents / 100).toString() : "500"
  );
  const [slotsTotal, setSlotsTotal] = useState(campaign?.slots_total?.toString() || "5");
  const [applyDeadline, setApplyDeadline] = useState(
    campaign?.apply_deadline?.slice(0, 10) ||
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [draftDeadline, setDraftDeadline] = useState(
    campaign?.draft_deadline?.slice(0, 10) ||
      new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [liveDate, setLiveDate] = useState(
    campaign?.live_date?.slice(0, 10) ||
      new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status || "draft");

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        brand_id: brandId,
        title,
        category,
        description,
        cover_image_url: coverImage || null,
        base_earning_cents: Math.round(parseFloat(baseEarning || "0") * 100),
        slots_total: parseInt(slotsTotal || "1", 10),
        apply_deadline: new Date(applyDeadline).toISOString(),
        draft_deadline: new Date(draftDeadline).toISOString(),
        live_date: new Date(liveDate).toISOString(),
        status,
      };
      if (isEdit) {
        return apiRequest("PATCH", `/api/admin/campaigns/${campaign!.id}`, payload);
      }
      return apiRequest("POST", `/api/admin/campaigns`, {
        ...payload,
        commission_pct: 0,
        product_bonus: false,
        tags: [],
        platforms: ["instagram"],
        deliverables: [{ kind: "Instagram Reel", qty: 1, spec: "30-60s vertical" }],
        dos: [],
        donts: [],
        featured: false,
        high_ticket: false,
        slots_filled: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit campaign" : "New campaign"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summer Skincare Summit"
              data-testid="input-title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Brand</Label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-sm"
                data-testid="select-brand"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-sm"
                data-testid="select-category"
              >
                <option>Beauty</option>
                <option>Tech</option>
                <option>Fashion</option>
                <option>Lifestyle</option>
                <option>Food</option>
                <option>Gifting</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="input-description"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cover image URL</Label>
            <Input
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
              data-testid="input-cover"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Base earning (INR)</Label>
              <Input
                type="number"
                value={baseEarning}
                onChange={(e) => setBaseEarning(e.target.value)}
                data-testid="input-earning"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Total slots</Label>
              <Input
                type="number"
                value={slotsTotal}
                onChange={(e) => setSlotsTotal(e.target.value)}
                data-testid="input-slots"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Apply by</Label>
              <Input type="date" value={applyDeadline} onChange={(e) => setApplyDeadline(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Draft by</Label>
              <Input type="date" value={draftDeadline} onChange={(e) => setDraftDeadline(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Live date</Label>
              <Input type="date" value={liveDate} onChange={(e) => setLiveDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CampaignStatus)}
              className="w-full h-10 px-3 rounded-md bg-background border border-input text-sm"
              data-testid="select-status"
            >
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!title || !brandId || saveMut.isPending}
              className="flex-1 glow-primary"
              data-testid="button-save"
            >
              {saveMut.isPending ? "Saving..." : isEdit ? "Save changes" : "Create campaign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
