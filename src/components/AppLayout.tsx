import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const AppLayout = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className={`flex-1 overflow-auto ${isMobile ? "pt-14" : "ml-64"}`}>
        <div className={`${isMobile ? "p-4" : "p-6 lg:p-8"}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
