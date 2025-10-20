import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import BrokerDashboard from "./pages/BrokerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import CCStaffDashboard from "./pages/CCStaffDashboard";
import { RequireAuth } from "./components/guards/RequireAuth";
import { RequireAdmin } from "./components/guards/RequireAdmin";
import { RequireStaff } from "./components/guards/RequireStaff";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Broker Portal - accessible by BROKER and ADMIN */}
          <Route
            path="/app/*"
            element={
              <RequireAuth>
                <BrokerDashboard />
              </RequireAuth>
            }
          />
          
          {/* Client Admin Portal - accessible by ADMIN only */}
          <Route
            path="/admin/*"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminDashboard />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          
          {/* CC Staff Dashboard - accessible by CC_STAFF only */}
          <Route
            path="/cc/*"
            element={
              <RequireAuth>
                <RequireStaff>
                  <CCStaffDashboard />
                </RequireStaff>
              </RequireAuth>
            }
          />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
