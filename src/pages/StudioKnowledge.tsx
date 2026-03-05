import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Tag } from "lucide-react";
import StudioLayout from "@/components/studio/StudioLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

const StudioKnowledge = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Tables<"knowledge_base">[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [user]);

  return (
    <StudioLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
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
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </StudioLayout>
  );
};

export default StudioKnowledge;
