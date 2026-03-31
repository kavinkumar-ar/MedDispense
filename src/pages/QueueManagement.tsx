import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Clock, UserPlus, Monitor, ArrowRight, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface QueueEntry {
  id: string;
  patient_id: string;
  token_number: string;
  priority: string;
  status: string;
  doctor_name: string | null;
  reason: string | null;
  estimated_wait_minutes: number | null;
  created_at: string;
  updated_at: string;
}

interface LiveQueueEntry {
  token_number: string;
  priority: string;
  status: string;
  doctor_name: string | null;
  estimated_wait_minutes: number | null;
  created_at: string;
  is_mine: boolean;
}

const priorityStyles: Record<string, string> = {
  normal: "bg-muted text-muted-foreground",
  urgent: "bg-destructive/10 text-destructive",
  elderly: "bg-warning/10 text-warning",
};

const statusStyles: Record<string, string> = {
  waiting: "bg-muted text-muted-foreground",
  in_progress: "bg-accent/10 text-accent",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const QueueManagement = () => {
  const { role, user } = useAuth();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [liveEntries, setLiveEntries] = useState<LiveQueueEntry[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Add patient form state
  const [newPatientName, setNewPatientName] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isWalkInMode, setIsWalkInMode] = useState(false);
  const [walkInPhone, setWalkInPhone] = useState("");

  const fetchQueue = async () => {
    setLoading(true);

    if (role === "patient") {
      // Patients use the anonymized RPC function to see all queue entries
      const { data, error } = await supabase.rpc("get_active_queue");
      if (error) {
        toast.error("Failed to load queue");
        setLoading(false);
        return;
      }
      setLiveEntries((data || []) as LiveQueueEntry[]);
    } else {
      // Staff see full queue with patient names
      const { data, error } = await supabase
        .from("queue_entries")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        toast.error("Failed to load queue");
        setLoading(false);
        return;
      }

      const priorityOrder: Record<string, number> = { urgent: 0, elderly: 1, normal: 2 };
      const statusOrder: Record<string, number> = { in_progress: 0, waiting: 1, completed: 2, cancelled: 3 };
      const sorted = (data || []).sort((a, b) => {
        const statusDiff = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
        if (statusDiff !== 0) return statusDiff;
        const priorityDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      setEntries(sorted);

      const patientIds = [...new Set((data || []).map((e) => e.patient_id))];
      if (patientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", patientIds);
        const nameMap: Record<string, string> = {};
        (profiles || []).forEach((p) => {
          nameMap[p.user_id] = p.full_name;
        });
        setPatientNames(nameMap);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel("queue-management-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = role === "patient"
    ? (filter === "all" ? liveEntries : liveEntries.filter((e) => e.status === filter))
    : (filter === "all" ? entries : entries.filter((e) => e.status === filter));

  const generateToken = () => {
    const prefix = "T";
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  };

  const handleAddPatient = async () => {
    if (!newPatientName.trim()) {
      toast.error("Patient name is required");
      return;
    }
    setSubmitting(true);

    let patientId = "";

    // For staff adding patients, look up by name or instantly create a walk-in queue record
    const { data: matchedProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .ilike("full_name", `%${newPatientName.trim()}%`)
      .limit(1);

    if (!matchedProfiles || matchedProfiles.length === 0) {
      if (!isWalkInMode) {
        toast.info("Patient not found. Walk-in registration unlocked.");
        setIsWalkInMode(true);
        setSubmitting(false);
        return;
      } else {
        // Securely invoke the remote database trigger bypassing GoTrue validations natively
        const { data: newUuid, error: walkinError } = await supabase
          .rpc("create_walkin_patient", { p_name: newPatientName.trim(), p_phone: walkInPhone.trim() || null });

        if (walkinError || !newUuid) {
          toast.error("Failed to register walk-in: " + (walkinError?.message || "Internal error"));
          setSubmitting(false);
          return;
        }
        patientId = newUuid as string;
      }
    } else {
      patientId = matchedProfiles[0].user_id;
    }

    const token = generateToken();

    const { error } = await supabase.from("queue_entries").insert({
      patient_id: patientId,
      token_number: token,
      priority: newPriority,
      doctor_name: newDoctorName.trim() || null,
      reason: newReason.trim() || null,
      status: "waiting",
    });

    if (error) {
      toast.error("Failed to add patient: " + error.message);
    } else {
      toast.success(`Patient added with token ${token}`);
      setDialogOpen(false);
      setNewPatientName("");
      setNewPriority("normal");
      setNewDoctorName("");
      setNewReason("");
      setIsWalkInMode(false);
      setWalkInPhone("");
      fetchQueue();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated");
      fetchQueue();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    const { error } = await supabase.from("queue_entries").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete record");
    } else {
      toast.success("Record deleted");
      fetchQueue();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Queue Management</h1>
          <p className="text-sm text-muted-foreground">Real-time patient queue tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchQueue} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          {role && role !== "patient" && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) setIsWalkInMode(false); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="h-4 w-4" /> Add Patient
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Patient to Queue</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Patient Name</Label>
                    <Input
                      placeholder="Search by patient name..."
                      value={newPatientName}
                      onChange={(e) => setNewPatientName(e.target.value)}
                    />
                  </div>
                  {isWalkInMode && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                      <Label className="text-primary font-semibold">Walk-In Contact Details (Optional)</Label>
                      <Input
                        placeholder="Phone number..."
                        value={walkInPhone}
                        onChange={(e) => setWalkInPhone(e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">This dynamically registers a brand new background profile.</p>
                    </motion.div>
                  )}
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="elderly">Elderly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Doctor Name (optional)</Label>
                    <Input
                      placeholder="e.g. Dr. Sharma"
                      value={newDoctorName}
                      onChange={(e) => setNewDoctorName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reason (optional)</Label>
                    <Textarea
                      placeholder="Reason for visit..."
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddPatient} disabled={submitting} className="w-full">
                    {submitting ? "Processing..." : isWalkInMode ? "Register Walk-In & Add to Queue" : "Add to Queue"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {["all", "waiting", "in_progress", "completed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Queue List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading queue...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No patients in queue.</p>
        ) : role === "patient" ? (
          <AnimatePresence>
            {(filtered as LiveQueueEntry[]).map((entry, idx) => (
              <motion.div
                key={entry.token_number + idx}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`stat-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${entry.is_mine ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-heading text-xs font-bold text-primary">
                    {entry.token_number}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {entry.is_mine ? "You" : `Patient #${idx + 1}`}
                      {entry.is_mine && <Badge className="ml-2 bg-primary/10 text-primary" variant="secondary">YOU</Badge>}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString()}</span>
                      {entry.doctor_name && (
                        <>
                          <span>•</span>
                          <span>{entry.doctor_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Badge className={priorityStyles[entry.priority] || priorityStyles.normal} variant="secondary">
                    {entry.priority}
                  </Badge>
                  <Badge className={statusStyles[entry.status] || statusStyles.waiting} variant="secondary">
                    {entry.status.replace("_", " ")}
                  </Badge>
                  {entry.estimated_wait_minutes && entry.status === "waiting" && (
                    <span className="text-xs text-muted-foreground">~{entry.estimated_wait_minutes} min</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <AnimatePresence>
            {(filtered as QueueEntry[]).map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="stat-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-heading text-xs font-bold text-primary">
                    {entry.token_number}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{patientNames[entry.patient_id] || "Unknown"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>{new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString()}</span>
                      {entry.reason && (
                        <>
                          <span>•</span>
                          <span className="truncate">{entry.reason}</span>
                        </>
                      )}
                      {entry.doctor_name && (
                        <>
                          <span>•</span>
                          <span>{entry.doctor_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Badge className={priorityStyles[entry.priority] || priorityStyles.normal} variant="secondary">
                    {entry.priority}
                  </Badge>
                  <Badge className={statusStyles[entry.status] || statusStyles.waiting} variant="secondary">
                    {entry.status.replace("_", " ")}
                  </Badge>
                  {entry.estimated_wait_minutes && entry.status === "waiting" && (
                    <span className="text-xs text-muted-foreground">~{entry.estimated_wait_minutes} min</span>
                  )}
                  {entry.status === "waiting" && (
                    <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => handleStatusChange(entry.id, "in_progress")}>
                      Start <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                  {entry.status === "in_progress" && (
                    <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => handleStatusChange(entry.id, "completed")}>
                      Complete <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                  {role === "admin" && (
                    <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default QueueManagement;
