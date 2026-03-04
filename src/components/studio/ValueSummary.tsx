import { Clock, DollarSign, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ValueSummaryProps {
  durationSeconds: number;
  showShare?: boolean;
}

const ENGINEER_RATE = 95; // $/hr
const MANUAL_MINUTES_PER_OUTPUT_MINUTE = 45;

export function calculateSavings(durationSeconds: number) {
  const outputMinutes = durationSeconds / 60;
  const timeSavedMinutes = outputMinutes * MANUAL_MINUTES_PER_OUTPUT_MINUTE;
  const moneySaved = (timeSavedMinutes / 60) * ENGINEER_RATE;
  return { timeSavedMinutes, moneySaved };
}

const ValueSummary = ({ durationSeconds, showShare = true }: ValueSummaryProps) => {
  const { timeSavedMinutes, moneySaved } = calculateSavings(durationSeconds);
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
