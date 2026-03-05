import { Clock, DollarSign, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { EffectParams } from "@/lib/effectPresets";

interface ValueSummaryProps {
  durationSeconds: number;
  params?: EffectParams;
  iterationRound?: number;
  mode?: "fresh" | "modify";
  showShare?: boolean;
}

const ENGINEER_RATE = 95; // $/hr

function getComplexityScore(params: EffectParams) {
  return Math.min(
    1,
    (params.distortion * 0.16) +
    (params.reverb * 0.12) +
    (params.delay * 0.11) +
    (params.chorus * 0.09) +
    (params.compression * 0.09) +
    (params.overdrive * 0.16) +
    ((Math.abs(params.eq.low) + Math.abs(params.eq.mid) + Math.abs(params.eq.high)) / 36) * 0.17 +
    ((params.gain - 1) / 1) * 0.1
  );
}

export function calculateSavings(
  durationSeconds: number,
  options?: {
    params?: EffectParams;
    iterationRound?: number;
    mode?: "fresh" | "modify";
  },
) {
  const complexity = options?.params ? getComplexityScore(options.params) : 0.5;
  const iterationRound = options?.iterationRound ?? 1;
  const modeMultiplier = options?.mode === "modify" ? 1.2 : 1;
  const manualMinutesPerOutputMinute = (24 + complexity * 42 + (iterationRound - 1) * 4) * modeMultiplier;
  const outputMinutes = durationSeconds / 60;
  const timeSavedMinutes = outputMinutes * manualMinutesPerOutputMinute;
  const moneySaved = (timeSavedMinutes / 60) * ENGINEER_RATE;
  return { timeSavedMinutes, moneySaved, manualMinutesPerOutputMinute };
}

const ValueSummary = ({
  durationSeconds,
  params,
  iterationRound = 1,
  mode = "fresh",
  showShare = true,
}: ValueSummaryProps) => {
  const { timeSavedMinutes, moneySaved, manualMinutesPerOutputMinute } = calculateSavings(durationSeconds, {
    params,
    iterationRound,
    mode,
  });
  const hours = Math.floor(timeSavedMinutes / 60);
  const mins = Math.round(timeSavedMinutes % 60);

  const handleShare = () => {
    const text = `I just saved $${moneySaved.toFixed(0)} and ${hours}h ${mins}m using Cue to Crunch 🎛️`;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="bg-glass rounded-2xl p-4 glow-primary">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Value Summary
      </p>
      <p className="text-[10px] text-muted-foreground mb-3">
        Estimated from {manualMinutesPerOutputMinute.toFixed(0)} manual min per output min
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-lg font-bold text-foreground font-mono">
              {hours}h {mins}m
            </p>
            <p className="text-[10px] text-muted-foreground">studio time saved</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <DollarSign className="w-4 h-4 text-secondary mt-0.5" />
          <div>
            <p className="text-lg font-bold text-foreground font-mono">
              ${moneySaved.toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground">in engineer fees</p>
          </div>
        </div>
      </div>
      {showShare && (
        <button
          onClick={handleShare}
          className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Share2 className="w-3 h-3" /> Share your savings
        </button>
      )}
    </div>
  );
};

export default ValueSummary;
