import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Activity, ShieldCheck, Stethoscope, Pill, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const roleConfig = {
  admin: { label: "Admin", icon: ShieldCheck, color: "text-destructive" },
  doctor: { label: "Doctor", icon: Stethoscope, color: "text-accent" },
  pharmacist: { label: "Pharmacist", icon: Pill, color: "text-primary" },
  patient: { label: "Patient", icon: UserRound, color: "text-success" },
} as const;

type RoleKey = keyof typeof roleConfig;

const Login = () => {
  const navigate = useNavigate();
  const { setRole } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleKey>("patient");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Verify user has the selected role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", selectedRole)
      .maybeSingle();

    if (!roleData) {
      await supabase.auth.signOut();
      toast({
        title: "Access denied",
        description: `Your account does not have ${roleConfig[selectedRole].label} access.`,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (data.session) {
      localStorage.setItem("jwt_token", data.session.access_token);
      localStorage.setItem("user_role", selectedRole);
      setRole(selectedRole);
    }

    toast({ title: "Welcome back!", description: `Logged in as ${roleConfig[selectedRole].label}` });
    navigate("/");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            MedDispense
          </h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>Select your role and log in to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Role selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              {(Object.keys(roleConfig) as RoleKey[]).map((key) => {
                const { label, icon: Icon, color } = roleConfig[key];
                const isActive = selectedRole === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedRole(key)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? "text-primary" : color}`} />
                    {label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : `Sign in as ${roleConfig[selectedRole].label}`}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              New patient?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Register here
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Login;
