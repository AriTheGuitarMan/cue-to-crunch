import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Tag, Upload, Sparkles } from "lucide-react";
import StudioLayout from "@/components/studio/StudioLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

const StudioKnowledge = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Tables<"knowledge_base">[]>([]);
  const [sessions, setSessions] = useState<Tables<"sessions">[]>([]);
  const [loading, setLoading] = useState(true);

  const displayNameFromAudioUrl = (url: string) => {
    const raw = decodeURIComponent(url.split("/").pop() || "audio");
    const withOriginalMarker = raw.includes("__") ? raw.split("__").slice(1).join("__") : raw;
    return withOriginalMarker.replace(/^\d+-/, "");
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("knowledge_base")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoading(false);
      });
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setSessions(data ?? []);
      });
  }, [user]);

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
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Knowledge Base</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          This is what ToneForge "knows" about your style and preferences, built from your past sessions.
        </p>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No knowledge entries yet. Start generating to build your profile!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              (() => {
                const anchor = entry.session_id ? byId.get(entry.session_id) : undefined;
                const rootId = anchor ? getRootId(anchor) : null;
                const chain = rootId
                  ? sessions
                    .filter((s) => getRootId(s) === rootId)
                    .sort((a, b) => a.iteration_round - b.iteration_round)
                  : [];
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
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => entry.session_id && navigate(`/studio?loadSession=${entry.session_id}`)}
                className={`bg-glass rounded-2xl p-4 ${entry.session_id ? "cursor-pointer hover:border-primary/30 transition-colors" : ""}`}
              >
                <p className="text-sm text-foreground">{entry.summary}</p>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                      >
                        <Tag className="w-2.5 h-2.5" /> {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
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
              })()
            ))}
          </div>
        )}
      </div>
    </StudioLayout>
  );
};

export default StudioKnowledge;
