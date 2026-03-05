import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Clock, DollarSign, RefreshCw, Upload, Sparkles } from "lucide-react";
import StudioLayout from "@/components/studio/StudioLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

function displayNameFromAudioUrl(url: string) {
  const raw = decodeURIComponent(url.split("/").pop() || "audio");
  const withOriginalMarker = raw.includes("__") ? raw.split("__").slice(1).join("__") : raw;
  return withOriginalMarker.replace(/^\d+-/, "");
}

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
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const getRootId = (session: Tables<"sessions">) => {
    let cursor: Tables<"sessions"> | undefined = session;
    let guard = 0;
    while (cursor?.parent_session_id && guard < 25) {
      cursor = byId.get(cursor.parent_session_id);
      guard++;
    }
    return cursor?.id ?? session.id;
  };

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
              const chain = sessions
                .filter((s) => getRootId(s) === session.id)
                .sort((a, b) => a.iteration_round - b.iteration_round);
              const iterationCount = chain.length;
              const inputAudioUrl = chain.find((s) => !!s.input_audio_url)?.input_audio_url ?? null;
              const outputRounds = chain
                .filter((s) => !!s.output_audio_url || !!s.input_audio_url)
                .map((s) => ({
                  id: s.id,
                  iteration_round: s.iteration_round,
                  outputAudioUrl: s.output_audio_url ?? s.input_audio_url,
                  isLegacyFallback: !s.output_audio_url,
                }));

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
                  {(inputAudioUrl || outputRounds.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-border/40 space-y-2" onClick={(e) => e.stopPropagation()}>
                      {inputAudioUrl && (
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5">
                          <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1 flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            Input File: {displayNameFromAudioUrl(inputAudioUrl)}
                          </p>
                          <audio controls src={inputAudioUrl} className="w-full h-9" />
                        </div>
                      )}
                      {outputRounds.length > 0 && (
                        <div className="space-y-2 rounded-xl border border-secondary/30 bg-secondary/5 p-2.5">
                          <p className="text-[10px] uppercase tracking-wider text-secondary font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Outputs ({outputRounds.length})
                          </p>
                          {outputRounds.map((round) => (
                            <div key={round.id} className="rounded-lg border border-secondary/20 bg-background/40 p-2">
                              <p className="text-[10px] text-secondary mb-1 font-medium">
                                Output File · Remix v{round.iteration_round}: {round.outputAudioUrl ? displayNameFromAudioUrl(round.outputAudioUrl) : "output"}
                                {round.isLegacyFallback ? " (legacy)" : ""}
                              </p>
                              {round.outputAudioUrl && (
                                <audio controls src={round.outputAudioUrl} className="w-full h-9" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
