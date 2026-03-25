import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Stethoscope,
  BarChart3,
  Pill,
  Package,
  Settings,
  LogOut,
  HeartPulse,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

type AppRole = "admin" | "doctor" | "pharmacist" | "patient";

const navItems: { to: string; icon: any; label: string; roles: AppRole[] }[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "doctor", "pharmacist"] },
  { to: "/patient", icon: HeartPulse, label: "My Dashboard", roles: ["patient"] },
  { to: "/queue", icon: Users, label: "Queue Status", roles: ["admin", "pharmacist", "patient"] },
  { to: "/prescriptions", icon: ClipboardList, label: "Prescriptions", roles: ["admin", "doctor", "pharmacist"] },
  { to: "/doctor", icon: Stethoscope, label: "Doctor Panel", roles: ["admin", "doctor"] },
  { to: "/pharmacist", icon: Pill, label: "Pharmacist Panel", roles: ["admin", "pharmacist"] },
  { to: "/inventory", icon: Package, label: "Inventory", roles: ["admin", "pharmacist"] },
  { to: "/analytics", icon: BarChart3, label: "Analytics", roles: ["admin"] },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { role, signOut } = useAuth();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Pill className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading text-base font-semibold text-sidebar-primary-foreground">
            MedDispense
          </h1>
          <p className="text-[11px] text-sidebar-foreground/60">
            {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Smart Pharmacy"}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.filter((item) => role && item.roles.includes(role)).map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border px-3 py-4 space-y-1">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <Settings className="h-[18px] w-[18px]" />
          Settings
        </NavLink>
        <button
          onClick={() => { onNavigate?.(); signOut(); }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-destructive transition-colors"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

const AppSidebar = () => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close sheet on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
        <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-sidebar px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 border-r-0">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary">
              <Pill className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="font-heading text-sm font-semibold text-sidebar-primary-foreground">
              MedDispense
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col">
      <SidebarContent />
    </aside>
  );
};

export default AppSidebar;
