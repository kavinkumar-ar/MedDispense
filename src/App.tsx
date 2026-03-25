import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const QueueManagement = lazy(() => import("./pages/QueueManagement"));
const Prescriptions = lazy(() => import("./pages/Prescriptions"));
const PharmacistPanel = lazy(() => import("./pages/PharmacistPanel"));
const Inventory = lazy(() => import("./pages/Inventory"));
const DoctorPanel = lazy(() => import("./pages/DoctorPanel"));
const Analytics = lazy(() => import("./pages/Analytics"));
const PatientDashboard = lazy(() => import("./pages/PatientDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false, // Prevents refetches on tab switch
    },
  },
});

const PageLoader = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
              <Route path="/patient" element={<Suspense fallback={<PageLoader />}><PatientDashboard /></Suspense>} />
              <Route path="/queue" element={<Suspense fallback={<PageLoader />}><QueueManagement /></Suspense>} />
              <Route path="/prescriptions" element={<Suspense fallback={<PageLoader />}><Prescriptions /></Suspense>} />
              <Route path="/doctor" element={<Suspense fallback={<PageLoader />}><DoctorPanel /></Suspense>} />
              <Route path="/pharmacist" element={<Suspense fallback={<PageLoader />}><PharmacistPanel /></Suspense>} />
              <Route path="/inventory" element={<Suspense fallback={<PageLoader />}><Inventory /></Suspense>} />
              <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
