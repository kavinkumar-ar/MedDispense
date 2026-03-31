import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, User, Phone, Calendar, Shield } from "lucide-react";
import { motion } from "framer-motion";

interface ProfileData {
  full_name: string;
  phone: string | null;
  age: number | null;
  created_at: string;
}

const Settings = () => {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) setProfile(data as any as ProfileData);
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-2">View your personal hospital profile and demographic details.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="w-4 h-4" /> Full Name
                </p>
                <p className="text-base font-medium text-foreground">{profile?.full_name || "Not provided"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Age
                </p>
                <p className="text-base font-medium text-foreground">{profile?.age ? `${profile.age} years old` : "Not provided"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Phone Number
                </p>
                <p className="text-base font-medium text-foreground">{profile?.phone || "Not provided"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Account Role
                </p>
                <p className="text-base font-medium capitalize text-foreground">{role || "Unknown"}</p>
              </div>
            </div>
            
            <div className="border-t pt-4 mt-6">
              <p className="text-xs text-muted-foreground">
                Currently, your profile baseline demographics are rigorously sealed in the database vault. If you need to legally update these details, please contact the hospital administration desk in person.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Settings;
