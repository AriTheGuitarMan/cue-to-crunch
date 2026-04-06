import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Studio from "./pages/Studio";
import StudioHistory from "./pages/StudioHistory";
import StudioKnowledge from "./pages/StudioKnowledge";
import StudioSettings from "./pages/StudioSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Navigate to="/studio" replace />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/studio/history" element={<StudioHistory />} />
            <Route path="/studio/knowledge" element={<StudioKnowledge />} />
            <Route path="/studio/settings" element={<StudioSettings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
