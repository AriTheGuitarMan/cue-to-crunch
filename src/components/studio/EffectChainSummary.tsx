import type { Tables } from "@/integrations/supabase/types";
import type { EffectParams } from "@/lib/effectPresets";
import { describeEffectParams } from "@/lib/effectChain";

interface EffectChainSummaryProps {
  iterations: Tables<"sessions">[];
  currentRound: number;
  currentParams: EffectParams;
}

const EffectChainSummary = ({
  iterations,
  currentRound,
  currentParams,
}: EffectChainSummaryProps) => {
  const chain = iterations.length > 0
    ? iterations
    : [{
        id: "current-draft",
        created_at: new Date().toISOString(),
        duration_seconds: null,
        effect_params: currentParams,
        input_audio_url: null,
        input_source: "upload",
        iteration_round: currentRound,
        money_saved: null,
        output_audio_url: null,
        parent_session_id: null,
        prompt_text: "Current mix",
        refinement_note: null,
        time_saved_minutes: null,
        user_id: "local",
      } satisfies Tables<"sessions">];

  return (
    <div className="space-y-3">
      {chain.map((iteration) => {
        const effectParams = (iteration.effect_params as EffectParams | null) ?? currentParams;
        const descriptors = describeEffectParams(effectParams);
        const isActive = iteration.iteration_round === currentRound;

        return (
          <div
            key={iteration.id}
            className={`rounded-2xl border p-4 ${isActive ? "border-primary/40 bg-primary/5" : "border-border/60 bg-glass"}`}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Remix v{iteration.iteration_round}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {iteration.refinement_note || iteration.prompt_text}
                </p>
              </div>
              {isActive && (
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                  Active
                </span>
              )}
            </div>

            {descriptors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {descriptors.map((effect) => (
                  <span
                    key={`${iteration.id}-${effect.key}`}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                      effect.emphasis === "primary"
                        ? "bg-primary/15 text-primary border border-primary/25"
                        : "bg-muted text-foreground/80 border border-border/60"
                    }`}
                  >
                    {effect.label}: {effect.value}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No active effects in this chain version.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EffectChainSummary;
