import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Clock, CheckCircle, FileText, Pill, Stethoscope, History, Loader2, AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DrugCheckDialog } from "@/components/DrugCheckDialog";

interface QueueEntry {
  id: string;
  patient_id: string;
  token_number: string;
  priority: string;
  status: string;
  reason: string | null;
  estimated_wait_minutes: number | null;
  created_at: string;
  patient_name?: string;
  patient_age?: number | null;
}

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
  rejection_reason?: string | null;
  patient_name?: string;
}

interface PastVisit {
  id: string;
  token_number: string;
  status: string;
  reason: string | null;
  doctor_name: string | null;
  created_at: string;
}

const priorityStyles: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive",
  elderly: "bg-warning/10 text-warning",
  normal: "bg-muted text-muted-foreground",
};

const statusStyles: Record<string, string> = {
  waiting: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  dispensed: "bg-success/10 text-success",
  ready: "bg-accent/10 text-accent",
  cancelled: "bg-destructive/10 text-destructive",
};

const DoctorPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<QueueEntry | null>(null);

  // Patient history
  const [patientHistory, setPatientHistory] = useState<Prescription[]>([]);
  const [pastVisits, setPastVisits] = useState<PastVisit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Prescription form
  const [medication, setMedication] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Drug check
  const [drugCheckOpen, setDrugCheckOpen] = useState(false);
  const [patientAllergies, setPatientAllergies] = useState<string | null>(null);
  const [rejectedRx, setRejectedRx] = useState<Prescription[]>([]);
  const [fixingPrescriptionId, setFixingPrescriptionId] = useState<string | null>(null);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from("queue_entries")
      .select("*")
      .in("status", ["waiting", "in_progress"])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching queue:", error);
      return;
    }

    const patientIds = [...new Set((data || []).map((e) => e.patient_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, age")
      .in("user_id", patientIds);

    const nameMap = new Map((profiles as any[])?.map((p) => [p.user_id, p.full_name]) || []);
    const ageMap = new Map((profiles as any[])?.map((p) => [p.user_id, p.age]) || []);

    const priorityOrder: Record<string, number> = { urgent: 0, elderly: 1, normal: 2 };
    const statusOrder: Record<string, number> = { in_progress: 0, waiting: 1 };

    const sorted = (data || [])
      .map((entry) => ({
        ...entry,
        patient_name: nameMap.get(entry.patient_id) || "Unknown Patient",
        patient_age: ageMap.get(entry.patient_id) || null,
      }))
      .sort((a, b) => {
        const statusDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
        if (statusDiff !== 0) return statusDiff;
        const priorityDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    setQueue(sorted);

    // Also fetch rejected prescriptions for this doctor
    if (user?.id) {
      const doctorName = user?.user_metadata?.full_name || user?.email || "";
      let baseQuery = (supabase as any)
        .from("prescriptions")
        .select("*, profiles!prescriptions_patient_id_fkey(full_name)")
        .eq("status", "rejected");
      
      if (doctorName) {
        baseQuery = baseQuery.or(`doctor_id.eq.${user.id},doctor_name.ilike.%${doctorName}%`);
      } else {
        baseQuery = baseQuery.eq("doctor_id", user.id);
      }

      const { data: rejectedData } = await baseQuery;
      
      setRejectedRx((rejectedData || []).map(r => ({
        ...r,
        patient_name: (r as any).profiles?.full_name || "Unknown"
      })));
    }

    setLoading(false);
  };

  const fetchPatientHistory = async (patientId: string) => {
    setHistoryLoading(true);

    const [rxRes, visitsRes, profileRes] = await Promise.all([
      supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_id", patientId)
        .order("prescribed_at", { ascending: false })
        .limit(20),
      supabase
        .from("queue_entries")
        .select("id, token_number, status, reason, doctor_name, created_at")
        .eq("patient_id", patientId)
        .in("status", ["completed", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("profiles")
        .select("allergies")
        .eq("user_id", patientId)
        .single(),
    ]);

    setPatientHistory(rxRes.data || []);
    setPastVisits(visitsRes.data || []);
    setPatientAllergies((profileRes.data as any)?.allergies || null);
    setHistoryLoading(false);
  };

  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel("doctor-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () => {
        fetchQueue();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "prescriptions" }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleStartConsultation = async (entry: QueueEntry) => {
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "in_progress" })
      .eq("id", entry.id);

    if (error) {
      toast({ title: "Error", description: "Failed to start consultation", variant: "destructive" });
    } else {
      toast({ title: "Consultation started", description: `Now seeing ${entry.patient_name}` });
      fetchQueue();
    }
  };

  const handleCompleteConsultation = async (entry: QueueEntry) => {
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "completed" })
      .eq("id", entry.id);

    if (error) {
      toast({ title: "Error", description: "Failed to complete consultation", variant: "destructive" });
    } else {
      toast({ title: "Consultation completed", description: `${entry.patient_name} marked as done` });
      fetchQueue();
    }
  };

  const openPrescriptionDialog = (entry: QueueEntry) => {
    setSelectedPatient(entry);
    setMedication("");
    setDosage("");
    setFrequency("");
    setDuration("");
    setNotes("");
    setPatientHistory([]);
    setPastVisits([]);
    setPrescriptionOpen(true);
    setFixingPrescriptionId(null); // Clear any previous fixing state
    fetchPatientHistory(entry.patient_id);
  };

  const handleFixPrescription = (rx: Prescription) => {
    // Construct a minimal QueueEntry for the dialog
    setSelectedPatient({
      id: "fixing", // special ID to indicate it's not from queue
      patient_id: rx.patient_id,
      patient_name: rx.patient_name || "Unknown",
      token_number: "RE-RX",
      priority: "normal",
      status: "in_progress",
      reason: "Re-prescribing rejected medication",
      created_at: new Date().toISOString(),
    } as any);

    // Pre-fill form
    setMedication(rx.medication);
    setDosage(rx.dosage);
    setFrequency(rx.frequency);
    setDuration(rx.duration || "");
    setNotes(rx.notes || "");
    setFixingPrescriptionId(rx.id);
    
    // Open dialog and fetch history
    setPrescriptionOpen(true);
    fetchPatientHistory(rx.patient_id);
  };

  const handlePrescribeClick = () => {
    if (!selectedPatient || !medication || !dosage || !frequency) return;
    setDrugCheckOpen(true);
  };

  const handleWritePrescription = async () => {
    if (!selectedPatient || !medication || !dosage || !frequency) return;
    setSubmitting(true);
    setDrugCheckOpen(false);

    const doctorProfile = user?.user_metadata?.full_name || user?.email || "Doctor";

    const { error } = await (supabase as any).from("prescriptions").insert({
      patient_id: selectedPatient.patient_id,
      doctor_id: user?.id,
      doctor_name: doctorProfile,
      medication,
      dosage,
      frequency,
      duration: duration || null,
      notes: notes || null,
      status: "pending",
    });

    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: "Failed to create prescription", variant: "destructive" });
      return;
    }

    // If we were fixing an old one, acknowledge it now
    if (fixingPrescriptionId) {
      await supabase
        .from("prescriptions")
        .update({ status: "acknowledged" })
        .eq("id", fixingPrescriptionId);
      setFixingPrescriptionId(null);
    }

    setSubmitting(false);
    fetchQueue();
    toast({ title: "Prescription created", description: `${medication} prescribed to ${selectedPatient.patient_name}` });
    setPrescriptionOpen(false);
  };

  const waitingCount = queue.filter((e) => e.status === "waiting").length;
  const inProgressCount = queue.filter((e) => e.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Doctor Panel</h1>
        <p className="text-sm text-muted-foreground">View your patient queue and write prescriptions</p>
      </div>

      {/* Rejected Prescriptions Alerts */}
      {rejectedRx.length > 0 && (
        <div className="space-y-3">
          {rejectedRx.map((rx) => (
            <motion.div
              key={rx.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-destructive shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm text-destructive">Prescription Rejected</h4>
                  <p className="text-sm">
                    <strong>{rx.medication}</strong> for <strong>{rx.patient_name}</strong> was rejected.
                  </p>
                  {rx.rejection_reason && (
                    <p className="mt-1 text-xs text-muted-foreground italic">
                      Reason: {rx.rejection_reason}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="text-xs h-8"
                  onClick={() => handleFixPrescription(rx)}
                >
                  <Pill className="mr-1 h-3 w-3" />
                  Fix & Re-prescribe
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-8 border-destructive/20 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    await (supabase as any).from("prescriptions").update({ status: "acknowledged" }).eq("id", rx.id);
                    fetchQueue();
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{waitingCount}</p>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inProgressCount}</p>
              <p className="text-xs text-muted-foreground">In Consultation</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{queue.length}</p>
              <p className="text-xs text-muted-foreground">Total in Queue</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Patient Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Patient Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading queue...</p>
          ) : queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No patients in queue</p>
          ) : (
            <div className="space-y-3">
              {queue.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                      {entry.token_number}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {entry.patient_name}
                        {entry.patient_age ? ` (${entry.patient_age}y)` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.reason || "General consultation"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={priorityStyles[entry.priority] || priorityStyles.normal} variant="secondary">
                      {entry.priority}
                    </Badge>
                    <Badge className={statusStyles[entry.status] || statusStyles.waiting} variant="secondary">
                      {entry.status.replace("_", " ")}
                    </Badge>

                    {entry.status === "waiting" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openPrescriptionDialog(entry)} title="View patient history">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleStartConsultation(entry)}>
                          Start
                        </Button>
                      </>
                    )}
                    {entry.status === "in_progress" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openPrescriptionDialog(entry)}>
                          <FileText className="mr-1 h-3 w-3" />
                          Prescribe
                        </Button>
                        <Button size="sm" onClick={() => handleCompleteConsultation(entry)}>
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Complete
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prescription Dialog with Patient History */}
      <Dialog open={prescriptionOpen} onOpenChange={setPrescriptionOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Patient Details & Prescription
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="history" className="gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Patient History
                </TabsTrigger>
                <TabsTrigger value="prescribe" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Write Prescription
                </TabsTrigger>
              </TabsList>

              {/* Patient History Tab */}
              <TabsContent value="history" className="mt-4">
                <div className="rounded-lg bg-muted p-3 mb-4">
                  <p className="text-sm font-medium">Patient: {selectedPatient.patient_name}</p>
                  <p className="text-xs text-muted-foreground">Token: {selectedPatient.token_number} · Reason: {selectedPatient.reason || "General consultation"}</p>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <ScrollArea className="h-[350px] pr-3">
                    <div className="space-y-4">
                      {/* Past Prescriptions */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                          <Pill className="h-3.5 w-3.5" />
                          Prescription History ({patientHistory.length})
                        </h4>
                        {patientHistory.length === 0 ? (
                          <div className="flex flex-col items-center py-6 text-muted-foreground">
                            <AlertCircle className="h-5 w-5 mb-1" />
                            <p className="text-xs">No prior prescriptions found</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {patientHistory.map((rx) => (
                              <div key={rx.id} className="rounded-lg border p-3 text-sm">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{rx.medication}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {rx.dosage} · {rx.frequency}{rx.duration ? ` · ${rx.duration}` : ""}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <Badge className={statusStyles[rx.status] || "bg-muted text-muted-foreground"} variant="secondary">
                                      {rx.status}
                                    </Badge>
                                  </div>
                                </div>
                                 <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                   <span>By {rx.doctor_name}</span>
                                   <span>{new Date(rx.prescribed_at).toLocaleDateString()}</span>
                                 </div>
                                 
                                 {rx.status === "rejected" && (
                                   <div className="mt-2 flex flex-col gap-2">
                                     {rx.rejection_reason && (
                                       <p className="text-xs text-destructive bg-destructive/10 p-2 rounded italic">
                                         Reason: {rx.rejection_reason}
                                       </p>
                                     )}
                                     <Button 
                                       size="sm" 
                                       variant="destructive" 
                                       className="h-7 text-[10px] w-fit"
                                       onClick={() => handleFixPrescription(rx)}
                                     >
                                       <Pill className="mr-1 h-3 w-3" />
                                       Fix & Re-prescribe
                                     </Button>
                                   </div>
                                 )}

                                 {rx.notes && (
                                   <p className="mt-1 text-xs italic text-muted-foreground border-t pt-1">
                                     {rx.notes}
                                   </p>
                                 )}
                               </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Past Visits */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5" />
                          Visit History ({pastVisits.length})
                        </h4>
                        {pastVisits.length === 0 ? (
                          <div className="flex flex-col items-center py-6 text-muted-foreground">
                            <AlertCircle className="h-5 w-5 mb-1" />
                            <p className="text-xs">No prior visits found</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pastVisits.map((visit) => (
                              <div key={visit.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                                <div>
                                  <p className="font-medium">{visit.reason || "General consultation"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {visit.doctor_name || "Any doctor"} · {visit.token_number}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge className={statusStyles[visit.status] || "bg-muted text-muted-foreground"} variant="secondary">
                                    {visit.status}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {new Date(visit.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Write Prescription Tab */}
              <TabsContent value="prescribe" className="mt-4">
                <div className="rounded-lg bg-muted p-3 mb-4">
                  <p className="text-sm font-medium">Patient: {selectedPatient.patient_name}</p>
                  <p className="text-xs text-muted-foreground">Token: {selectedPatient.token_number}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Medication *</Label>
                    <Input value={medication} onChange={(e) => setMedication(e.target.value)} placeholder="e.g. Amoxicillin 500mg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Dosage *</Label>
                      <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 1 tablet" />
                    </div>
                    <div>
                      <Label>Frequency *</Label>
                      <Select value={frequency} onValueChange={setFrequency}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Once daily">Once daily</SelectItem>
                          <SelectItem value="Twice daily">Twice daily</SelectItem>
                          <SelectItem value="Three times daily">Three times daily</SelectItem>
                          <SelectItem value="Every 6 hours">Every 6 hours</SelectItem>
                          <SelectItem value="As needed">As needed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 7 days" />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional instructions..." rows={2} />
                  </div>
                </div>

                <Button onClick={handlePrescribeClick} disabled={submitting || !medication || !dosage || !frequency} className="w-full mt-4 gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  {submitting ? "Creating..." : "Check Safety & Create Prescription"}
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Drug Safety Check Dialog */}
      {selectedPatient && (
        <DrugCheckDialog
          open={drugCheckOpen}
          onOpenChange={setDrugCheckOpen}
          medication={medication}
          dosage={dosage}
          frequency={frequency}
          duration={duration}
          patientId={selectedPatient.patient_id}
          patientAllergies={patientAllergies}
          currentMedications={patientHistory.filter(rx => rx.status === "dispensed" || rx.status === "pending").map(rx => rx.medication)}
          onProceed={handleWritePrescription}
          onCancel={() => setDrugCheckOpen(false)}
        />
      )}
    </div>
  );
};

export default DoctorPanel;
