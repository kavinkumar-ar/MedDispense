import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"admin" | "doctor" | "pharmacist" | "patient">;
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { session, role, loading } = useAuth();
  const token = localStorage.getItem("jwt_token");

  // Read role synchronously from localStorage to prevent "Access Denied" 
  // UI flashes during React state-batching delays right after login clicks.
  const activeRole = role || (localStorage.getItem("user_role") as any);

  // Basic JWT structure validation (3 parts separated by dots)
  const isValidJwt = token && token.split('.').length === 3;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session || !token || !isValidJwt) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!activeRole || !allowedRoles.includes(activeRole))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
