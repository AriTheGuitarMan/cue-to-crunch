import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Clock, DollarSign, RefreshCw } from "lucide-react";
import StudioLayout from "@/components/studio/StudioLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

const StudioHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Tables<"sessions">[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchSessions = async () => {
      let query = supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (search.trim()) {
        query = query.ilike("prompt_text", `%${search}%`);
      }

      const { data } = await query;
      setSessions(data ?? []);
      setLoading(false);
    };
    fetchSessions();
  }, [user, search]);

  // Group by parent_session_id (root sessions)
  const rootSessions = sessions.filter((s) => s.iteration_round === 1);

  return (
    <StudioLayout>
      <div className="px-3 sm:px-6 py-5 sm:py-8 max-w-4xl mx-auto space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Session History</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by prompt..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground/50"
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : rootSessions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No sessions yet. Generate your first tone!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rootSessions.map((session) => {
              const iterationCount = sessions.filter(
                (s) => s.parent_session_id === session.id || s.id === session.id
              ).length;

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/studio?loadSession=${session.id}`)}
                  className="bg-glass rounded-2xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.prompt_text}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="font-mono">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 capitalize">
                          {session.input_source === "recording" ? "🎙️ Live" : "📁 Upload"}
                        </span>
                        {iterationCount > 1 && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> {iterationCount} rounds
                          </span>
                        )}
                        {session.duration_seconds && (
                          <span>{Number(session.duration_seconds).toFixed(1)}s</span>
                        )}
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      {session.time_saved_minutes && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <Clock className="w-3 h-3" />
                          {Math.round(Number(session.time_saved_minutes))}m saved
                        </div>
                      )}
                      {session.money_saved && (
                        <div className="flex items-center gap-1 text-xs text-secondary mt-1">
                          <DollarSign className="w-3 h-3" />
                          ${Number(session.money_saved).toFixed(0)}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </StudioLayout>
  );
};

export default StudioHistory;
