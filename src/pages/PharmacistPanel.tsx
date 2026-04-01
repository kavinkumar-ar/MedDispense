import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, AlertTriangle, Eye, CheckCircle, X, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DrugCheckDialog } from "@/components/DrugCheckDialog";

interface PrescriptionWithPatient {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  notes: string | null;
  doctor_name: string;
  status: string;
  prescribed_at: string;
  patient_id: string;
  patient_name: string;
  patient_age?: number | null;
}

const pharmacists = [
  { id: 1, name: "Dr. Palaniappan Manickam", counter: 1, status: "active", processed: 34, pending: 6, avgTime: "3.2 min", workload: 78 },
  { id: 2, name: "Dr. Sharmila", counter: 2, status: "active", processed: 28, pending: 4, avgTime: "3.8 min", workload: 62 },
  { id: 3, name: "Dr. Balaji", counter: 3, status: "active", processed: 41, pending: 8, avgTime: "2.9 min", workload: 92 },
  { id: 4, name: "Dr. Kavya", counter: 4, status: "break", processed: 22, pending: 0, avgTime: "3.5 min", workload: 0 },
];

const PharmacistPanel = () => {
  const [pendingRx, setPendingRx] = useState<PrescriptionWithPatient[]>([]);
  const [selectedRx, setSelectedRx] = useState<PrescriptionWithPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [drugCheckOpen, setDrugCheckOpen] = useState(false);
  const [drugCheckTarget, setDrugCheckTarget] = useState<PrescriptionWithPatient | null>(null);
  const [patientAllergies, setPatientAllergies] = useState<string | null>(null);
  const [patientMedications, setPatientMedications] = useState<string[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<PrescriptionWithPatient | null>(null);
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [billingTarget, setBillingTarget] = useState<{rx: PrescriptionWithPatient, stock: any} | null>(null);
  const [dispenseQuantity, setDispenseQuantity] = useState(1);
  const [isPaid, setIsPaid] = useState(false);

  const fetchPending = async () => {
    const { data: rxData } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("status", "pending")
      .order("prescribed_at", { ascending: false });

    if (!rxData?.length) {
      setPendingRx([]);
      setLoading(false);
      return;
    }

    const patientIds = [...new Set(rxData.map((r) => r.patient_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, age")
      .in("user_id", patientIds);

    const nameMap = new Map((profiles as any[])?.map((p) => [p.user_id, p.full_name]) ?? []);
    const ageMap = new Map((profiles as any[])?.map((p) => [p.user_id, p.age]) ?? []);

    setPendingRx(
      rxData.map((r) => ({
        ...r,
        patient_name: nameMap.get(r.patient_id) || "Unknown",
        patient_age: ageMap.get(r.patient_id) || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();

    const channel = supabase
      .channel("pharmacist-rx")
      .on("postgres_changes", { event: "*", schema: "public", table: "prescriptions" }, () => {
        fetchPending();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const startDrugCheck = async (rx: PrescriptionWithPatient) => {
    // Fetch patient allergies and other medications
    const [profileRes, otherRxRes] = await Promise.all([
      supabase.from("profiles").select("allergies").eq("user_id", rx.patient_id).single(),
      supabase.from("prescriptions").select("medication").eq("patient_id", rx.patient_id)
        .in("status", ["dispensed", "pending"]).neq("id", rx.id),
    ]);

    setPatientAllergies((profileRes.data as any)?.allergies || null);
    setPatientMedications((otherRxRes.data || []).map((r) => r.medication));
    setDrugCheckTarget(rx);
    setDrugCheckOpen(true);
  };

  const handleApprove = async (rx: PrescriptionWithPatient) => {
    // Check inventory availability first
    const { data: stockItem } = await supabase
      .from("inventory")
      .select("id, quantity, medicine_name, unit_price")
      .ilike("medicine_name", rx.medication)
      .maybeSingle();

    if (!stockItem) {
      toast.error(`"${rx.medication}" not found in inventory. Please add it before dispensing.`);
      return;
    }

    if (stockItem.quantity <= 0) {
      toast.error(`"${rx.medication}" is out of stock (0 remaining). Cannot dispense.`);
      return;
    }

    // Open billing dialog instead of direct approval
    setDispenseQuantity(1);
    setIsPaid(false);
    setBillingTarget({ rx, stock: stockItem });
    setBillingDialogOpen(true);
  };

  const confirmBillingAndDispense = async () => {
    if (!billingTarget) return;
    const { rx, stock: stockItem } = billingTarget;
    
    if (dispenseQuantity > stockItem.quantity) {
      toast.error(`Not enough stock. Only ${stockItem.quantity} units available.`);
      return;
    }

    setLoading(true);

    // 1. Create Billing Record
    const totalPrice = (stockItem.unit_price || 0) * dispenseQuantity;
    const { data: bill, error: billError } = await (supabase as any)
      .from("billing_records")
      .insert({
        prescription_id: rx.id,
        patient_id: rx.patient_id,
        total_amount: totalPrice,
        status: isPaid ? "paid" : "pending",
        paid_at: isPaid ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (billError) {
      toast.error("Failed to generate bill: " + billError.message);
      setLoading(false);
      return;
    }

    // 2. Decrement stock
    const { error: stockError } = await supabase
      .from("inventory")
      .update({ 
        quantity: stockItem.quantity - dispenseQuantity 
      })
      .eq("id", stockItem.id);

    if (stockError) {
      toast.error("Failed to update stock: " + stockError.message);
      setLoading(false);
      return;
    }

    // 3. Update prescription status
    const { error } = await supabase
      .from("prescriptions")
      .update({ 
        status: "dispensed",
        quantity_dispensed: dispenseQuantity
      })
      .eq("id", rx.id);

    if (error) {
      toast.error("Failed to approve: " + error.message);
    } else {
      const remaining = stockItem.quantity - dispenseQuantity;
      toast.success(`Bill generated for ₹${totalPrice.toFixed(2)}. Prescription dispensed.`);
      
      // 4. Log the dispense event to inventory history
      await (supabase as any).from("inventory_history").insert({
        inventory_id: stockItem.id,
        medicine_name: rx.medication,
        change_type: "removed",
        quantity_before: stockItem.quantity,
        quantity_after: remaining,
        quantity_changed: -dispenseQuantity,
        reason: `Dispensed & Billed via prescription #${rx.id.slice(0, 8)}`,
        performed_by: (await supabase.auth.getUser()).data.user?.id || null,
      });

      setBillingDialogOpen(false);
      setBillingTarget(null);
      setSelectedRx(null);
      fetchPending();
    }
    setLoading(false);
  };

  const handleReject = (rx: PrescriptionWithPatient) => {
    setRejectTarget(rx);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    const { error } = await supabase
      .from("prescriptions")
      .update({ 
        status: "rejected",
        rejection_reason: rejectReason.trim()
      } as any)
      .eq("id", rejectTarget.id);

    if (error) {
      toast.error("Failed to reject: " + error.message);
    } else {
      toast.success(`Prescription for ${rejectTarget.medication} rejected`);
      setRejectDialogOpen(false);
      setRejectTarget(null);
      setSelectedRx(null);
      fetchPending();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Pharmacist Dashboard</h1>
        <p className="text-sm text-muted-foreground">Workload monitoring & prescription verification</p>
      </div>

      {/* Pharmacist Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {pharmacists.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="stat-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-heading text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Counter {p.counter}</p>
                </div>
              </div>
              <Badge className={p.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"} variant="secondary">
                {p.status}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{p.processed}</p>
                <p className="text-[11px] text-muted-foreground">Processed</p>
              </div>
              <div>
                <p className="text-lg font-bold">{p.pending}</p>
                <p className="text-[11px] text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-lg font-bold">{p.avgTime}</p>
                <p className="text-[11px] text-muted-foreground">Avg Time</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Workload</span>
                <span className={`font-medium ${p.workload > 85 ? "text-destructive" : p.workload > 60 ? "text-warning" : "text-success"}`}>
                  {p.workload}%
                </span>
              </div>
              <Progress value={p.workload} className="mt-1.5 h-2" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pending Prescriptions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="stat-card">
        <h3 className="mb-4 font-heading text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Pending Prescriptions ({pendingRx.length})
        </h3>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : pendingRx.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending prescriptions</p>
        ) : (
          <div className="space-y-3">
            {pendingRx.map((rx) => (
              <div key={rx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className="bg-warning/10 text-warning shrink-0" variant="secondary">pending</Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {rx.medication} — {rx.patient_name}
                      {rx.patient_age ? ` (${rx.patient_age}y)` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rx.dosage}, {rx.frequency} · Dr. {rx.doctor_name}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedRx(rx)}>
                    <Eye className="mr-1 h-3 w-3" /> Review
                  </Button>
                  <Button size="sm" className="text-xs gap-1" onClick={() => startDrugCheck(rx)}>
                    <ShieldAlert className="h-3 w-3" /> Check & Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Review Dialog */}
      <Dialog open={!!selectedRx} onOpenChange={(open) => !open && setSelectedRx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Prescription</DialogTitle>
          </DialogHeader>
          {selectedRx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Patient:</span> <strong>{selectedRx.patient_name}</strong></div>
                <div><span className="text-muted-foreground">Doctor:</span> <strong>{selectedRx.doctor_name}</strong></div>
                <div><span className="text-muted-foreground">Medication:</span> <strong>{selectedRx.medication}</strong></div>
                <div><span className="text-muted-foreground">Dosage:</span> <strong>{selectedRx.dosage}</strong></div>
                <div><span className="text-muted-foreground">Frequency:</span> <strong>{selectedRx.frequency}</strong></div>
                <div><span className="text-muted-foreground">Duration:</span> <strong>{selectedRx.duration || "N/A"}</strong></div>
              </div>
              {selectedRx.notes && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <span className="text-muted-foreground">Notes:</span> {selectedRx.notes}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="destructive" size="sm" onClick={() => handleReject(selectedRx)}>
                  <X className="mr-1 h-3 w-3" /> Reject
                </Button>
                <Button size="sm" className="gap-1" onClick={() => startDrugCheck(selectedRx)}>
                  <ShieldAlert className="mr-1 h-3 w-3" /> Check & Dispense
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drug Safety Check Dialog */}
      {drugCheckTarget && (
        <DrugCheckDialog
          open={drugCheckOpen}
          onOpenChange={setDrugCheckOpen}
          medication={drugCheckTarget.medication}
          dosage={drugCheckTarget.dosage}
          frequency={drugCheckTarget.frequency}
          duration={drugCheckTarget.duration || ""}
          patientId={drugCheckTarget.patient_id}
          patientAllergies={patientAllergies}
          currentMedications={patientMedications}
          onProceed={() => handleApprove(drugCheckTarget)}
          onCancel={() => { setDrugCheckOpen(false); setDrugCheckTarget(null); }}
        />
      )}
      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reason for Rejection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <textarea
              className="w-full rounded-md border p-2 text-sm"
              rows={4}
              placeholder="Explain why this prescription is being rejected (e.g. dosage too high, medicine out of stock)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmReject}>Confirm Reject</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billing & Dispense Dialog */}
      <Dialog open={billingDialogOpen} onOpenChange={setBillingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Finalize Billing & Dispense
            </DialogTitle>
          </DialogHeader>
          {billingTarget && (
            <div className="space-y-6 py-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Medicine:</span>
                  <span className="font-semibold">{billingTarget.rx.medication}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unit Price:</span>
                  <span className="font-semibold">₹{billingTarget.stock.unit_price?.toFixed(2) || "0.00"}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity to Dispense</label>
                  <input
                    type="number"
                    min="1"
                    max={billingTarget.stock.quantity}
                    className="w-full rounded-md border p-2"
                    value={dispenseQuantity}
                    onChange={(e) => setDispenseQuantity(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-[11px] text-muted-foreground">Available Stock: {billingTarget.stock.quantity}</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="paid-status"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                  />
                  <label htmlFor="paid-status" className="text-sm font-medium">Payment Received</label>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Amount:</span>
                    <span className="text-primary">₹{((billingTarget.stock.unit_price || 0) * dispenseQuantity).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setBillingDialogOpen(false)}>Cancel</Button>
                <Button className="flex-1 gap-2" onClick={confirmBillingAndDispense} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Generate Bill & Dispense
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PharmacistPanel;
