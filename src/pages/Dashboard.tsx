import { useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { Clock, Users, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import StatCard from "@/components/StatCard";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const hourlyData = [
  { hour: "8AM", patients: 12 }, { hour: "9AM", patients: 28 }, { hour: "10AM", patients: 45 },
  { hour: "11AM", patients: 52 }, { hour: "12PM", patients: 38 }, { hour: "1PM", patients: 30 },
  { hour: "2PM", patients: 42 }, { hour: "3PM", patients: 35 }, { hour: "4PM", patients: 22 },
  { hour: "5PM", patients: 15 },
];

const waitTimeData = [
  { hour: "8AM", avg: 4 }, { hour: "9AM", avg: 8 }, { hour: "10AM", avg: 14 },
  { hour: "11AM", avg: 18 }, { hour: "12PM", avg: 12 }, { hour: "1PM", avg: 9 },
  { hour: "2PM", avg: 15 }, { hour: "3PM", avg: 11 }, { hour: "4PM", avg: 7 },
  { hour: "5PM", avg: 5 },
];

interface QueueEntry {
  id: string;
  patient_id: string;
  token_number: string;
  priority: string;
  status: string;
  doctor_name: string | null;
  estimated_wait_minutes: number | null;
  created_at: string;
}

const statusStyles: Record<string, string> = {
  waiting: "bg-muted text-muted-foreground",
  in_progress: "bg-accent/10 text-accent",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const priorityStyles: Record<string, string> = {
  normal: "bg-muted text-muted-foreground",
  urgent: "bg-destructive/10 text-destructive",
  elderly: "bg-warning/10 text-warning",
};

const Dashboard = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const { data: queueData, isLoading: isLoadingQueue } = useQuery({
    queryKey: ["queue_entries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("queue_entries")
        .select("*")
        .in("status", ["waiting", "in_progress"])
        .order("created_at", { ascending: true });
      return (data as QueueEntry[]) || [];
    }
  });

  const { data: patientNames = {}, isLoading: isLoadingNames } = useQuery({
    queryKey: ["patient_names", queueData?.map(e => e.patient_id)],
    enabled: !!queueData && queueData.length > 0,
    queryFn: async () => {
      const ids = [...new Set(queueData!.map((e) => e.patient_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p) => { map[p.user_id] = p.full_name; });
      return map;
    }
  });

  const { data: prescriptionCount = 0 } = useQuery({
    queryKey: ["prescriptions_count"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());
      return count || 0;
    }
  });

  const queueEntries = useMemo(() => {
    const entries = queueData || [];
    const priorityOrder: Record<string, number> = { urgent: 0, elderly: 1, normal: 2 };
    const statusOrder: Record<string, number> = { in_progress: 0, waiting: 1 };
    return [...entries].sort((a, b) => {
      const sd = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
      if (sd !== 0) return sd;
      const pd = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      if (pd !== 0) return pd;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [queueData]);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () => {
        queryClient.invalidateQueries({ queryKey: ["queue_entries"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "prescriptions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["prescriptions_count"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  if (role === "patient") {
    return <Navigate to="/patient" replace />;
  }

  const { waitingCount, inProgressCount, totalInQueue, avgWait } = useMemo(() => {
    const total = queueEntries.length;
    const waiting = queueEntries.filter((e) => e.status === "waiting").length;
    const inProgress = queueEntries.filter((e) => e.status === "in_progress").length;
    const avg = total > 0
      ? (queueEntries.reduce((sum, e) => sum + (e.estimated_wait_minutes || 0), 0) / total).toFixed(1)
      : "0";
    return { waitingCount: waiting, inProgressCount: inProgress, totalInQueue: total, avgWait: avg };
  }, [queueEntries]);

  if (isLoadingQueue) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time pharmacy operations overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Avg Wait Time" value={`${avgWait} min`} icon={Clock} color="primary" />
        <StatCard title="Patients in Queue" value={totalInQueue} icon={Users} subtitle={`${inProgressCount} being served`} color="accent" />
        <StatCard title="Prescriptions Today" value={prescriptionCount} icon={CheckCircle2} color="success" />
        <StatCard title="Waiting" value={waitingCount} icon={AlertTriangle} subtitle={`${inProgressCount} in progress`} color="warning" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="stat-card">
          <h3 className="mb-4 font-heading text-sm font-semibold">Patient Flow (Hourly)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
              <Bar dataKey="patients" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="stat-card">
          <h3 className="mb-4 font-heading text-sm font-semibold">Avg Wait Time (min)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={waitTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
              <Line type="monotone" dataKey="avg" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Real-time Queue */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="stat-card">
        <h3 className="mb-4 font-heading text-sm font-semibold">Live Queue ({totalInQueue})</h3>
        {queueEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No patients currently in queue.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Token</th>
                  <th className="pb-2 font-medium">Patient</th>
                  <th className="pb-2 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Doctor</th>
                  <th className="pb-2 font-medium">Est. Wait</th>
                </tr>
              </thead>
              <tbody>
                {queueEntries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{entry.token_number}</td>
                    <td className="py-3">{patientNames[entry.patient_id] || "Unknown"}</td>
                    <td className="py-3">
                      <Badge className={priorityStyles[entry.priority] || priorityStyles.normal} variant="secondary">
                        {entry.priority}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge className={statusStyles[entry.status] || statusStyles.waiting} variant="secondary">
                        {entry.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3">{entry.doctor_name || "—"}</td>
                    <td className="py-3">{entry.estimated_wait_minutes ? `${entry.estimated_wait_minutes} min` : "—"}</td>
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

export default Dashboard;
