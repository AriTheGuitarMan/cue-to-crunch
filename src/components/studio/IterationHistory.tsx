import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

interface IterationHistoryProps {
  iterations: Tables<"sessions">[];
  currentRound: number;
  onSelectIteration: (iteration: Tables<"sessions">) => void;
}

const IterationHistory = ({ iterations, currentRound, onSelectIteration }: IterationHistoryProps) => {
  const [open, setOpen] = useState(false);

  if (iterations.length <= 1) return null;

  return (
    <div className="bg-glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
      >
        <span>Remix Versions ({iterations.length})</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="border-t border-border/50 divide-y divide-border/30">
          {iterations.map((iter) => (
            <button
              key={iter.id}
              onClick={() => onSelectIteration(iter)}
              className={`w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors ${
                iter.iteration_round === currentRound ? "bg-primary/5 border-l-2 border-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Remix v{iter.iteration_round}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(iter.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {iter.refinement_note || iter.prompt_text}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default IterationHistory;
