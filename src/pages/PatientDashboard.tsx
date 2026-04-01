import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Pill, Stethoscope, Plus, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface QueueEntry {
  id: string;
  token_number: string;
  priority: string;
  status: string;
  doctor_name: string | null;
  reason: string | null;
  estimated_wait_minutes: number | null;
  created_at: string;
}

interface LiveQueueItem {
  token_number: string;
  patient_display_name: string;
  priority: string;
  status: string;
  doctor_name: string | null;
  estimated_wait_minutes: number | null;
  created_at: string;
  is_mine: boolean;
}

interface Prescription {
  id: string;
  doctor_name: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  status: string;
  notes: string | null;
  prescribed_at: string;
  quantity_dispensed?: number | null;
}

interface BillingRecord {
  id: string;
  prescription_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

const statusStyles: Record<string, string> = {
  waiting: "bg-warning/10 text-warning",
  in_progress: "bg-accent/10 text-accent",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  pending: "bg-warning/10 text-warning",
  dispensed: "bg-success/10 text-success",
  ready: "bg-accent/10 text-accent",
  rejected: "bg-destructive/10 text-destructive",
};

const PatientDashboard = () => {
  const { user } = useAuth();
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [liveQueue, setLiveQueue] = useState<LiveQueueItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [bills, setBills] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("normal");
  const [doctorName, setDoctorName] = useState("");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [queueRes, prescRes, liveQueueRes, billsRes] = await Promise.all([
      supabase
        .from("queue_entries")
        .select("*")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_id", user.id)
        .order("prescribed_at", { ascending: false }),
      supabase.rpc("get_active_queue"),
      (supabase as any)
        .from("billing_records")
        .select("*")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (queueRes.data) setQueueEntries(queueRes.data);
    if (prescRes.data) setPrescriptions(prescRes.data);
    if (liveQueueRes.data) setLiveQueue(liveQueueRes.data as LiveQueueItem[]);
    if (billsRes.data) setBills(billsRes.data);
    setLoading(false);
  };

  const handleDownloadPrescription = (rx: Prescription) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Prescription - ${rx.medication}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 2px solid #22c55e; padding-bottom: 20px; margin-bottom: 30px; }
            .hospital-name { font-size: 24px; font-weight: bold; color: #22c55e; }
            .rx-title { font-size: 20px; margin-bottom: 20px; text-decoration: underline; }
            .details { margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .medication { font-size: 18px; font-weight: bold; margin: 20px 0; padding: 15px; background: #f0fdf4; border-radius: 8px; }
            .footer { margin-top: 50px; border-top: 1px solid #eee; pt: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="hospital-name">MedDispense PHARMACY</div>
            <div>Digital Prescription Record</div>
          </div>
          <div class="rx-title">PRESCRIPTION DETAILS</div>
          <div class="details">
            <div><strong>Patient ID:</strong> ${user?.id?.slice(0,8) || 'N/A'}</div>
            <div><strong>Date:</strong> ${new Date(rx.prescribed_at).toLocaleDateString()}</div>
            <div><strong>Doctor:</strong> ${rx.doctor_name}</div>
            <div><strong>Status:</strong> ${rx.status.toUpperCase()}</div>
          </div>
          <div class="medication">
            Rx: ${rx.medication} (${rx.dosage})<br/>
            <small>Frequency: ${rx.frequency} | Duration: ${rx.duration || 'As directed'}</small>
          </div>
          ${rx.notes ? `<div style="margin-top: 10px;"><strong>Instructions:</strong> ${rx.notes}</div>` : ''}
          <div class="footer">
            This is a computer-generated prescription record from MedDispense AI.
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  useEffect(() => {
    fetchData();

    if (!user) return;

    // Realtime subscription for queue updates with notifications
    const queueChannel = supabase
      .channel("patient-queue-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "queue_entries",
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new?.status as string;
          const oldStatus = payload.old?.status as string;
          const token = payload.new?.token_number as string;
          const doctor = payload.new?.doctor_name as string;

          if (newStatus !== oldStatus) {
            if (newStatus === "in_progress") {
              toast.success(`🩺 Doctor ${doctor || ""} is ready to see you! (Token: ${token})`, {
                duration: 8000,
              });
            } else if (newStatus === "completed") {
              toast.info(`✅ Your consultation (Token: ${token}) is complete.`, {
                duration: 6000,
              });
            } else if (newStatus === "cancelled") {
              toast.warning(`Your queue entry (Token: ${token}) has been cancelled.`, {
                duration: 6000,
              });
            }
          }
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "queue_entries",
          filter: `patient_id=eq.${user.id}`,
        },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "queue_entries",
          filter: `patient_id=eq.${user.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    // Realtime subscription for new prescriptions
    const rxChannel = supabase
      .channel("patient-rx-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "prescriptions",
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          const med = payload.new?.medication as string;
          const doctor = payload.new?.doctor_name as string;
          toast.success(`💊 New prescription from ${doctor}: ${med}`, {
            duration: 8000,
          });
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "prescriptions",
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new?.status as string;
          const oldStatus = payload.old?.status as string;
          const med = payload.new?.medication as string;

          if (newStatus !== oldStatus) {
            if (newStatus === "dispensed") {
              toast.success(`✅ Your prescription for ${med} has been dispensed!`, {
                duration: 6000,
              });
            } else if (newStatus === "ready") {
              toast.info(`📦 Your prescription for ${med} is ready for pickup!`, {
                duration: 6000,
              });
            }
          }
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "prescriptions",
          filter: `patient_id=eq.${user.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    // Realtime subscription for ALL queue changes to update live queue view
    const liveQueueChannel = supabase
      .channel("patient-live-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_entries" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(rxChannel);
      supabase.removeChannel(liveQueueChannel);
    };
  }, [user]);

  const handleRequestDoctor = async () => {
    if (!user) return;
    setSubmitting(true);

    const tokenNum = `P-${Date.now().toString().slice(-4)}`;

    const { error } = await supabase.from("queue_entries").insert({
      patient_id: user.id,
      token_number: tokenNum,
      priority,
      reason: reason || null,
      doctor_name: doctorName || null,
      status: "waiting",
    });

    if (error) {
      toast.error("Failed to join queue: " + error.message);
    } else {
      toast.success(`You've been added to the queue! Token: ${tokenNum}`);
      setReason("");
      setPriority("normal");
      setDoctorName("");
      setDialogOpen(false);
      fetchData();
    }
    setSubmitting(false);
  };

  const activeQueue = queueEntries.filter(
    (e) => e.status === "waiting" || e.status === "in_progress"
  );
  const myPosition = liveQueue.findIndex((item) => item.is_mine);
  const queuePosition = myPosition >= 0 ? myPosition + 1 : 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Track your queue position and prescriptions
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Request Doctor Visit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request to See a Doctor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Doctor Name (optional)
                </label>
                <Input
                  placeholder="e.g. Dr. Sharma"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Priority
                </label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="elderly">Elderly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Reason for Visit
                </label>
                <Textarea
                  placeholder="Briefly describe your symptoms or reason..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <Button
                onClick={handleRequestDoctor}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Join Queue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="stat-card flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
            <Clock className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Queue Position</p>
            <p className="text-2xl font-bold">
              {activeQueue.length > 0 ? `#${queuePosition}` : "—"}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="stat-card flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Stethoscope className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Visits</p>
            <p className="text-2xl font-bold">{activeQueue.length}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <Pill className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Prescriptions</p>
            <p className="text-2xl font-bold font-heading">
              {prescriptions.length}
            </p>
          </div>
        </motion.div>

        {/* Total Bills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="stat-card flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <span className="text-xl font-bold text-success font-heading">₹</span>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Pending Bills
            </p>
            <p className="text-2xl font-bold font-heading text-destructive">
              ₹{(bills || []).filter(b => b.status === 'pending').reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0).toFixed(2)}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Bills & History */}
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.2 }}
           className="stat-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-sm font-semibold flex items-center gap-2">
              <span className="text-success font-heading font-bold text-lg">₹</span>
              Bills & Payments
            </h3>
          </div>
          {(!bills || bills.length === 0) ? (
            <div className="py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
              <p className="text-xs">No billing records found yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => {
                const rx = (prescriptions || []).find(r => r.id === bill.prescription_id);
                return (
                  <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{rx?.medication || 'Medication'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(bill.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">₹{(Number(bill.total_amount) || 0).toFixed(2)}</p>
                      <Badge variant="secondary" className={`text-[9px] h-4 px-1.5 ${bill.status === 'paid' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive animate-pulse'}`}>
                        {(bill.status || 'PENDING').toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Active Queue */}
        <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="stat-card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-sm font-semibold">
            Live Queue ({liveQueue.length} patients)
          </h3>
          {queuePosition > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Your position: #{queuePosition}
            </span>
          )}
        </div>
        {liveQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="mb-2 h-8 w-8" />
            <p className="text-sm">No patients in queue right now.</p>
            <p className="text-xs">Click "Request Doctor Visit" to join.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Token</th>
                  <th className="pb-2 font-medium text-center">Patient</th>
                  <th className="pb-2 font-medium">Doctor</th>
                  <th className="pb-2 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Est. Wait</th>
                </tr>
              </thead>
              <tbody>
                {liveQueue.map((entry, index) => (
                  <tr
                    key={entry.token_number + index}
                    className={`border-b last:border-0 ${
                      entry.is_mine
                        ? "bg-primary/5 font-semibold"
                        : ""
                    }`}
                  >
                    <td className="py-3 text-muted-foreground">{index + 1}</td>
                    <td className="py-3 font-medium">
                      {entry.token_number}
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant="outline" className={entry.is_mine ? "border-primary text-primary" : "text-muted-foreground"}>
                        {entry.patient_display_name}
                      </Badge>
                    </td>
                    <td className="py-3">{entry.doctor_name || "Any"}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          entry.priority === "urgent"
                            ? "bg-destructive/10 text-destructive"
                            : entry.priority === "elderly"
                            ? "bg-warning/10 text-warning"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {entry.priority}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          statusStyles[entry.status] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {entry.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3">
                      {entry.status === "waiting"
                        ? (() => {
                            const waitingOnly = liveQueue.filter(e => e.status === "waiting");
                            const pos = waitingOnly.findIndex(e => e.token_number === entry.token_number);
                            return `~${(pos + 1) * 10} min`;
                          })()
                        : entry.status === "in_progress" ? "Consulting now" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
      </div>

      {/* Queue History */}
      {queueEntries.filter((e) => e.status === "completed" || e.status === "cancelled").length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="stat-card">
          <h3 className="mb-4 font-heading text-sm font-semibold">Visit History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Token</th>
                  <th className="pb-2 font-medium">Doctor</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {queueEntries
                  .filter((e) => e.status === "completed" || e.status === "cancelled")
                  .slice(0, 10)
                  .map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{entry.token_number}</td>
                      <td className="py-3">{entry.doctor_name || "Any"}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[entry.status] || ""}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Prescriptions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="stat-card"
      >
        <h3 className="mb-4 font-heading text-sm font-semibold">
          My Prescriptions
        </h3>
        {prescriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Pill className="mb-2 h-8 w-8" />
            <p className="text-sm">No prescriptions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Medication & Status</th>
                  <th className="pb-2 font-medium">Frequency</th>
                  <th className="pb-2 font-medium">Doctor</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((rx) => (
                  <tr key={rx.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{rx.medication}</p>
                          <p className="text-[10px] text-muted-foreground">{rx.dosage}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] scale-90 sm:scale-100"
                            onClick={() => handleDownloadPrescription(rx)}
                          >
                            Download
                          </Button>
                          <Badge className={`${statusStyles[rx.status] || "bg-muted text-muted-foreground"} text-[10px] px-1.5 py-0`}>
                            {rx.status}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-sm">{rx.frequency}</td>
                    <td className="py-3 text-sm">{rx.doctor_name}</td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {new Date(rx.prescribed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PatientDashboard;
