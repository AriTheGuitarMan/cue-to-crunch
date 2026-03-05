import { Plus, History, Brain, Settings, Clock, DollarSign, LogOut, Guitar } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "New Generation", url: "/studio", icon: Plus },
  { title: "History", url: "/studio/history", icon: History },
  { title: "Knowledge Base", url: "/studio/knowledge", icon: Brain },
  { title: "Settings", url: "/studio/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [savings, setSavings] = useState({ time: 0, money: 0 });
  const [analytics, setAnalytics] = useState({ sessions: 0, avgMinutes: 0, monthMoney: 0 });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("lifetime_time_saved_minutes, lifetime_money_saved")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSavings({
            time: data.lifetime_time_saved_minutes,
            money: data.lifetime_money_saved,
          });
        }
      });

    supabase
      .from("sessions")
      .select("time_saved_minutes, money_saved, created_at")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const sessions = data ?? [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthMoney = sessions
          .filter((s) => {
            const created = new Date(s.created_at);
            return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
          })
          .reduce((sum, s) => sum + Number(s.money_saved ?? 0), 0);
        const totalTime = sessions.reduce((sum, s) => sum + Number(s.time_saved_minutes ?? 0), 0);
        setAnalytics({
          sessions: sessions.length,
          avgMinutes: sessions.length > 0 ? totalTime / sessions.length : 0,
          monthMoney,
        });
      });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <div className="flex items-center gap-2">
              <Guitar className="w-4 h-4 text-primary" />
              {!collapsed && <span className="font-bold">ToneForge</span>}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="px-3 py-2 rounded-xl bg-muted/50 space-y-1 mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Lifetime Savings
            </p>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3 h-3 text-primary" />
              <span className="text-foreground font-mono">
                {Math.floor(savings.time / 60)}h {Math.round(savings.time % 60)}m
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <DollarSign className="w-3 h-3 text-secondary" />
              <span className="text-foreground font-mono">
                ${savings.money.toFixed(0)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
              {analytics.sessions} sessions • {Math.round(analytics.avgMinutes)}m avg saved each
            </p>
            <p className="text-[10px] text-muted-foreground">
              This month: ${analytics.monthMoney.toFixed(0)}
            </p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
