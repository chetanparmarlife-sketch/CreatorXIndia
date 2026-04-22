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
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CommunityItem, EventKind } from "@shared/schema";

export default function AdminCommunityPage() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<CommunityItem | null>(null);
  const [creating, setCreating] = useState(false);

  const { data } = useQuery<{ items: CommunityItem[] }>({ queryKey: ["/api/admin/community"] });

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<CommunityItem>) => {
      if (editing) await apiRequest("PATCH", `/api/admin/community/${editing.id}`, patch);
      else await apiRequest("POST", "/api/admin/community", patch);
    },
    onSuccess: () => {
      toast({ title: editing ? "Item updated" : "Item published" });
      setEditing(null); setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/community/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/community"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community"] });
    },
  });

  const items = data?.items || [];

  return (
    <AdminShell
      title="Community"
      subtitle={`${items.length} events, perks & news`}
      actions={
        <Button onClick={() => setCreating(true)} className="h-9 rounded-lg font-bold">
          <Icon name="add" className="text-[18px] mr-1" />
          New item
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        {items.map((i) => (
          <div key={i.id} className="bg-card border border-border rounded-2xl overflow-hidden hover-elevate">
            <div className="relative aspect-video bg-muted">
              {i.cover_image_url && <img src={i.cover_image_url} alt="" className="w-full h-full object-cover" />}
              <div className="absolute top-2 left-2">
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-white"
                )}>
                  {i.kind}
                </span>
              </div>
              {!i.published && (
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-amber-500/60 backdrop-blur text-white">
                    Draft
                  </span>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="font-extrabold line-clamp-2 mb-1">{i.title}</div>
              {i.starts_at && <div className="text-xs text-muted-foreground">{fmtDate(i.starts_at)} · {i.city || "online"}</div>}
              <div className="text-xs text-muted-foreground mt-1">
                {i.registered}/{i.capacity || "∞"} registered
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setEditing(i)}
                  className="flex-1 h-8 rounded-lg bg-muted text-xs font-bold hover-elevate"
                  data-testid={`button-edit-${i.id}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => { if (confirm("Delete?")) deleteMut.mutate(i.id); }}
                  className="size-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover-elevate"
                  data-testid={`button-delete-${i.id}`}
                >
                  <Icon name="delete" className="text-[14px]" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CommunityEditor
        open={creating || editing !== null}
        item={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(p) => saveMut.mutate(p)}
        loading={saveMut.isPending}
      />
    </AdminShell>
  );
}

function CommunityEditor({ open, item, onClose, onSave, loading }: {
  open: boolean;
  item: CommunityItem | null;
  onClose: () => void;
  onSave: (p: Partial<CommunityItem>) => void;
  loading: boolean;
}) {
  const [kind, setKind] = useState<EventKind>(item?.kind || "event");
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [cover, setCover] = useState(item?.cover_image_url || "");
  const [city, setCity] = useState(item?.city || "");
  const [locationName, setLocationName] = useState(item?.location_name || "");
  const [startsAt, setStartsAt] = useState(item?.starts_at?.slice(0, 16) || "");
  const [capacity, setCapacity] = useState(item?.capacity?.toString() || "");
  const [priceCents, setPriceCents] = useState(item?.price_cents?.toString() || "0");
  const [published, setPublished] = useState(item?.published ?? true);

  if (open && item && title === "") {
    setKind(item.kind);
    setTitle(item.title);
    setDescription(item.description);
    setCover(item.cover_image_url || "");
    setCity(item.city || "");
    setLocationName(item.location_name || "");
    setStartsAt(item.starts_at?.slice(0, 16) || "");
    setCapacity(item.capacity?.toString() || "");
    setPriceCents(item.price_cents.toString());
    setPublished(item.published);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit" : "New"} community item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Type</label>
            <div className="flex gap-2">
              {(["event", "perk", "news"] as EventKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "flex-1 h-10 rounded-lg text-xs font-bold uppercase tracking-widest capitalize hover-elevate",
                    kind === k ? "bg-primary text-primary-foreground" : "bg-background border border-border"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background border-border h-11" />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="bg-background border-border resize-none" />
          </Field>
          <Field label="Cover image URL">
            <Input value={cover} onChange={(e) => setCover(e.target.value)} className="bg-background border-border h-11" />
          </Field>
          {kind === "event" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} className="bg-background border-border h-11" /></Field>
                <Field label="Venue"><Input value={locationName} onChange={(e) => setLocationName(e.target.value)} className="bg-background border-border h-11" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts at"><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="bg-background border-border h-11" /></Field>
                <Field label="Capacity"><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="bg-background border-border h-11" /></Field>
              </div>
              <Field label="Price (cents)">
                <Input type="number" value={priceCents} onChange={(e) => setPriceCents(e.target.value)} className="bg-background border-border h-11" />
              </Field>
            </>
          )}
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-bold text-sm">Published</div>
              <div className="text-xs text-muted-foreground">Visible to creators</div>
            </div>
            <Switch checked={published} onCheckedChange={setPublished} />
          </div>
          <Button
            onClick={() => onSave({
              kind, title, description,
              cover_image_url: cover || null,
              city: city || null,
              location_name: locationName || null,
              starts_at: startsAt ? new Date(startsAt).toISOString() : null,
              capacity: capacity ? parseInt(capacity) : null,
              price_cents: parseInt(priceCents) || 0,
              published,
            })}
            disabled={loading || !title}
            className="w-full h-11 rounded-lg font-bold glow-primary"
          >
            {loading ? "Saving..." : item ? "Save changes" : "Publish"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
