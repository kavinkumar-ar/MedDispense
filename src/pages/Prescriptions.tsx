import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Search, Trash2, Loader2, Pill, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Prescription {
  id: string;
  patient_id: string;
  doctor_name: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  status: string;
  notes: string | null;
  prescribed_at: string;
}

const statusIcon: Record<string, React.ReactNode> = {
  dispensed: <CheckCircle2 className="h-4 w-4 text-success" />,
  rejected: <XCircle className="h-4 w-4 text-destructive" />,
  pending: <AlertTriangle className="h-4 w-4 text-warning" />,
  ready: <CheckCircle2 className="h-4 w-4 text-accent" />,
};

const statusBadge: Record<string, string> = {
  dispensed: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  pending: "bg-warning/10 text-warning",
  ready: "bg-accent/10 text-accent",
};

const Prescriptions = () => {
  const { role } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [patientAges, setPatientAges] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchPrescriptions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prescriptions")
      .select("*")
      .order("prescribed_at", { ascending: false });

    if (error) {
      toast.error("Failed to load prescriptions");
      setLoading(false);
      return;
    }

    setPrescriptions(data || []);

    // Fetch patient names
    const patientIds = [...new Set((data || []).map((p) => p.patient_id))];
    if (patientIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, age")
        .in("user_id", patientIds);
      const nameMap: Record<string, string> = {};
      const ageMap: Record<string, number | null> = {};
      (profiles as any[])?.forEach((p) => {
        nameMap[p.user_id] = p.full_name;
        ageMap[p.user_id] = p.age;
      });
      setPatientNames(nameMap);
      setPatientAges(ageMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPrescriptions();

    const channel = supabase
      .channel("prescriptions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "prescriptions" }, () => {
        fetchPrescriptions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prescription? This will also remove it from the patient's dashboard.")) return;
    const { error } = await supabase.from("prescriptions").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete prescription: " + error.message);
    } else {
      toast.success("Prescription deleted successfully");
      fetchPrescriptions();
    }
  };

  const filtered = prescriptions.filter((rx) => {
    const patientName = patientNames[rx.patient_id] || "";
    const matchSearch =
      patientName.toLowerCase().includes(search.toLowerCase()) ||
      rx.medication.toLowerCase().includes(search.toLowerCase()) ||
      rx.doctor_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filterStatus === "all" || rx.status === filterStatus;
    return matchSearch && matchFilter;
  });

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
          <h1 className="font-heading text-2xl font-bold">Prescription Records</h1>
          <p className="text-sm text-muted-foreground">View and manage all prescriptions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPrescriptions} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by patient, medication or doctor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "dispensed", "rejected", "ready"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Prescription List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Pill className="mb-2 h-8 w-8" />
            <p className="text-sm">No prescriptions found.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((rx, i) => (
              <motion.div
                key={rx.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.03 }}
                className="stat-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {statusIcon[rx.status] || <Pill className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-sm font-semibold">{rx.medication}</span>
                        <Badge className={statusBadge[rx.status] || "bg-muted text-muted-foreground"} variant="secondary">
                          {rx.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm">
                        {patientNames[rx.patient_id] || "Unknown Patient"}
                        {patientAges[rx.patient_id] ? ` (${patientAges[rx.patient_id]}y)` : ""}
                        <span className="text-muted-foreground"> • {rx.doctor_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(rx.prescribed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {role === "admin" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleDelete(rx.id)}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    )}
                  </div>
                </div>

                {/* Medication Details */}
                <div className="mt-3 rounded-lg bg-muted/50 p-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="pb-1.5 font-medium">Dosage</th>
                        <th className="pb-1.5 font-medium">Frequency</th>
                        <th className="pb-1.5 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border/50">
                        <td className="py-1.5 font-medium">{rx.dosage}</td>
                        <td className="py-1.5">{rx.frequency}</td>
                        <td className="py-1.5">{rx.duration || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {rx.notes && (
                  <div className="mt-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium">Notes:</span> {rx.notes}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default Prescriptions;
