import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

const dailyThroughput = [
  { day: "Mon", prescriptions: 165 }, { day: "Tue", prescriptions: 198 },
  { day: "Wed", prescriptions: 187 }, { day: "Thu", prescriptions: 210 },
  { day: "Fri", prescriptions: 245 }, { day: "Sat", prescriptions: 178 },
];

const peakHourData = [
  { hour: "8AM", load: 20 }, { hour: "9AM", load: 55 }, { hour: "10AM", load: 85 },
  { hour: "11AM", load: 95 }, { hour: "12PM", load: 60 }, { hour: "1PM", load: 45 },
  { hour: "2PM", load: 75 }, { hour: "3PM", load: 65 }, { hour: "4PM", load: 40 },
  { hour: "5PM", load: 25 },
];

const counterUtilization = [
  { name: "Counter 1", value: 78 },
  { name: "Counter 2", value: 62 },
  { name: "Counter 3", value: 92 },
  { name: "Counter 4", value: 45 },
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
];

const waitTrend = [
  { week: "W1", avg: 14.2 }, { week: "W2", avg: 12.8 }, { week: "W3", avg: 11.1 },
  { week: "W4", avg: 9.5 }, { week: "W5", avg: 8.2 },
];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  fontSize: 12,
};

const Analytics = () => (
  <div className="space-y-6">
    <div>
      <h1 className="font-heading text-2xl font-bold">Analytics</h1>
      <p className="text-sm text-muted-foreground">Performance tracking & peak-hour pattern analysis</p>
    </div>

    {/* Summary */}
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
      {[
        { label: "Weekly Avg Wait", value: "8.2 min", change: "-18%" },
        { label: "Daily Throughput", value: "197 Rx", change: "+12%" },
        { label: "Counter Utilization", value: "69%", change: "+5%" },
        { label: "Flag Rate", value: "4.3%", change: "-2.1%" },
      ].map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card text-center">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="mt-1 font-heading text-xl font-bold">{s.value}</p>
          <p className={`mt-0.5 text-xs font-medium ${s.change.startsWith("-") ? "text-success" : "text-accent"}`}>{s.change}</p>
        </motion.div>
      ))}
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      {/* Daily Throughput */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="stat-card">
        <h3 className="mb-4 font-heading text-sm font-semibold">Daily Prescription Throughput</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dailyThroughput}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="prescriptions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Peak Hour Heatmap */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="stat-card">
        <h3 className="mb-4 font-heading text-sm font-semibold">Peak Hour Load (%)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={peakHourData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="load" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Counter Utilization Pie */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="stat-card">
        <h3 className="mb-4 font-heading text-sm font-semibold">Counter Utilization</h3>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={counterUtilization} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
              {counterUtilization.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Wait Time Trend */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="stat-card">
        <h3 className="mb-4 font-heading text-sm font-semibold">Avg Wait Time Trend (Weekly)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={waitTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" unit=" min" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="avg" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  </div>
);

export default Analytics;
