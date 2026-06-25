import { useEffect, useRef, useState } from "react";
import cortexLogo from "@/assets/cortex-logo.svg";
import { cn } from "@/lib/utils";

interface LoadingSplashProps {
  onDone: () => void;
}

export function LoadingSplash({ onDone }: LoadingSplashProps) {
  const [fading, setFading] = useState(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1700);
    const doneTimer = setTimeout(() => onDoneRef.current(), 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []); // intentionally empty — timers should run exactly once on mount

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A0F1C]",
        "transition-opacity duration-[400ms] ease-in-out",
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      {/* Logo with purple glow */}
      <div className="relative mb-8">
        <div
          className="absolute rounded-full"
          style={{
            inset: "-40px",
            background: "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)",
          }}
        />
        <img
          src={cortexLogo}
          alt="Cortex"
          className="relative h-16 w-16"
          style={{ filter: "drop-shadow(0 0 18px rgba(168,85,247,0.5))" }}
        />
      </div>

      {/* Brand name */}
      <div
        className="font-semibold text-[28px] tracking-[0.14em] text-foreground"
        style={{ fontFamily: "var(--font-brand)" }}
      >
        CORTEX
      </div>
      <div className="mt-2 text-[10px] tracking-[0.36em] text-muted-foreground/55 uppercase">
        Support Co-Pilot
      </div>

      {/* Animated scan line */}
      <div className="mt-14 w-44 h-px rounded overflow-hidden relative bg-[#1E293B]">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, transparent 0%, #3B82F6 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.3s ease-in-out infinite",
          }}
        />
      </div>
      <div className="mt-4 text-[9px] tracking-[0.5em] text-muted-foreground/30 uppercase">
        Initializing
      </div>
    </div>
  );
}
