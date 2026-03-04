import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface StudioLayoutProps {
  children: ReactNode;
}

const StudioLayout = ({ children }: StudioLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/50 bg-background/60 backdrop-blur-xl sticky top-0 z-40">
            <SidebarTrigger className="ml-2" />
            <span className="ml-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">
              STUDIO
            </span>
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default StudioLayout;
