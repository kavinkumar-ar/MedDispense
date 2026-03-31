import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Package, AlertTriangle, Plus, Search, Edit2, Trash2, Save, X, TrendingDown, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  medicine_name: string;
  generic_name: string | null;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  batch_number: string | null;
  expiry_date: string | null;
  supplier: string | null;
  unit_price: number | null;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  medicine_name: "",
  generic_name: "",
  quantity: 0,
  unit: "tablets",
  low_stock_threshold: 20,
  batch_number: "",
  expiry_date: "",
  supplier: "",
  unit_price: 0,
};

const Inventory = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("medicine_name");

      if (error) {
        toast.error("Failed to load inventory");
        return [];
      }
      return (data as InventoryItem[]) || [];
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel("inventory-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm({
      medicine_name: item.medicine_name,
      generic_name: item.generic_name || "",
      quantity: item.quantity,
      unit: item.unit,
      low_stock_threshold: item.low_stock_threshold,
      batch_number: item.batch_number || "",
      expiry_date: item.expiry_date || "",
      supplier: item.supplier || "",
      unit_price: item.unit_price || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.medicine_name.trim()) {
      toast.error("Medicine name is required");
      return;
    }
    setSaving(true);

    const payload = {
      medicine_name: form.medicine_name.trim(),
      generic_name: form.generic_name.trim() || null,
      quantity: Number(form.quantity),
      unit: form.unit,
      low_stock_threshold: Number(form.low_stock_threshold),
      batch_number: form.batch_number.trim() || null,
      expiry_date: form.expiry_date || null,
      supplier: form.supplier.trim() || null,
      unit_price: form.unit_price ? Number(form.unit_price) : null,
    };

    if (editItem) {
      const { error } = await supabase.from("inventory").update(payload).eq("id", editItem.id);
      if (error) toast.error("Update failed: " + error.message);
      else toast.success("Inventory updated");
    } else {
      const { error } = await supabase.from("inventory").insert(payload);
      if (error) toast.error("Insert failed: " + error.message);
      else toast.success("Medicine added to inventory");
    }

    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!confirm(`Delete "${item.medicine_name}" from inventory?`)) return;

    // Optimistically remove from UI immediately
    queryClient.setQueryData(["inventory"], (old: InventoryItem[] | undefined) =>
      (old || []).filter((i) => i.id !== item.id)
    );

    const { error } = await supabase.from("inventory").delete().eq("id", item.id);

    if (error) {
      toast.error("Delete failed: " + error.message);
      // Rollback optimistic update
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } else {
      toast.success(`${item.medicine_name} removed`);
      // Force re-fetch to confirm deletion (handles silent RLS failures)
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  };

  const { filtered, lowStockCount, outOfStockCount } = useMemo(() => {
    const fil = items.filter((item) => {
      const matchesSearch =
        item.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
        (item.generic_name || "").toLowerCase().includes(search.toLowerCase());

      if (filter === "low") return matchesSearch && item.quantity > 0 && item.quantity <= item.low_stock_threshold;
      if (filter === "out") return matchesSearch && item.quantity === 0;
      return matchesSearch;
    });

    const low = items.filter((i) => i.quantity > 0 && i.quantity <= i.low_stock_threshold).length;
    const out = items.filter((i) => i.quantity === 0).length;

    return { filtered: fil, lowStockCount: low, outOfStockCount: out };
  }, [items, search, filter]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading inventory data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">Track medicine stock and availability</p>
        </div>
        <Button onClick={openAdd} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Medicine
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="stat-card text-center">
          <Package className="mx-auto h-5 w-5 text-primary mb-1" />
          <p className="text-2xl font-bold">{items.length}</p>
          <p className="text-xs text-muted-foreground">Total Medicines</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="stat-card text-center">
          <TrendingDown className="mx-auto h-5 w-5 text-warning mb-1" />
          <p className="text-2xl font-bold text-warning">{lowStockCount}</p>
          <p className="text-xs text-muted-foreground">Low Stock</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-destructive mb-1" />
          <p className="text-2xl font-bold text-destructive">{outOfStockCount}</p>
          <p className="text-xs text-muted-foreground">Out of Stock</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="stat-card text-center">
          <Package className="mx-auto h-5 w-5 text-success mb-1" />
          <p className="text-2xl font-bold text-success">{items.length - lowStockCount - outOfStockCount}</p>
          <p className="text-xs text-muted-foreground">In Stock</p>
        </motion.div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search medicines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "low", "out"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="text-xs"
            >
              {f === "all" ? "All" : f === "low" ? `Low (${lowStockCount})` : `Out (${outOfStockCount})`}
            </Button>
          ))}
        </div>
      </div>

      {/* Inventory List */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="stat-card">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medicines found</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const isLow = item.quantity > 0 && item.quantity <= item.low_stock_threshold;
              const isOut = item.quantity === 0;

              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 ${
                    isOut ? "border-destructive/30 bg-destructive/5" : isLow ? "border-warning/30 bg-warning/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      className={
                        isOut
                          ? "bg-destructive/10 text-destructive shrink-0"
                          : isLow
                          ? "bg-warning/10 text-warning shrink-0"
                          : "bg-success/10 text-success shrink-0"
                      }
                      variant="secondary"
                    >
                      {isOut ? "OUT" : isLow ? "LOW" : "OK"}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.medicine_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.generic_name && `${item.generic_name} · `}
                        {item.quantity} {item.unit}
                        {item.batch_number && ` · Batch: ${item.batch_number}`}
                        {item.expiry_date && ` · Exp: ${item.expiry_date}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => openEdit(item)}>
                      <Edit2 className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Medicine Name *</Label>
              <Input value={form.medicine_name} onChange={(e) => setForm({ ...form, medicine_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Generic Name</Label>
              <Input value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Low Threshold</Label>
                <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Batch Number</Label>
                <Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Expiry Date</Label>
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Supplier</Label>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Unit Price (₹)</Label>
                <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-3 w-3" /> {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
