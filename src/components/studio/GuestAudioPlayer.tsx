import { useEffect, useState } from "react";
import { isGuestAudioRef, resolveGuestAudioSrc } from "@/lib/guestAudioStore";

interface GuestAudioPlayerProps {
  src: string;
  className?: string;
}

const GuestAudioPlayer = ({ src, className }: GuestAudioPlayerProps) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(isGuestAudioRef(src) ? null : src);

  useEffect(() => {
    let cancelled = false;

    if (!isGuestAudioRef(src)) {
      setResolvedSrc(src);
      return;
    }

    resolveGuestAudioSrc(src)
      .then((next) => {
        if (!cancelled) setResolvedSrc(next);
      })
      .catch(() => {
        if (!cancelled) setResolvedSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!resolvedSrc) {
    return <p className="text-[10px] text-muted-foreground">Loading audio preview...</p>;
  }

  return <audio controls src={resolvedSrc} className={className ?? "w-full h-9"} />;
};

export default GuestAudioPlayer;
