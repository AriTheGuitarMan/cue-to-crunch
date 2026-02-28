import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Zap } from "lucide-react";

const prompts = [
  "warm blues tone with smooth reverb",
  "heavy metal crunch, tight low-end",
  "shoegaze dreamy wall of sound",
  "funky clean with wah and compression",
  "lo-fi indie jangle with chorus",
];

const Hero = () => {
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    const prompt = prompts[currentPrompt];
    let i = 0;
    setDisplayText("");

    const typeInterval = setInterval(() => {
      if (i <= prompt.length) {
        setDisplayText(prompt.slice(0, i));
        i++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => {
          setCurrentPrompt((prev) => (prev + 1) % prompts.length);
        }, 2000);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [currentPrompt]);

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container relative z-10 px-6 py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-glass mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="text-sm font-medium text-muted-foreground">
              VST3 / AU Plugin — Coming 2026
            </span>
          </motion.div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            <span className="text-foreground">Type your </span>
            <span className="text-gradient-primary glow-text">tone.</span>
            <br />
            <span className="text-foreground">Hear it </span>
            <span className="text-gradient-primary glow-text">instantly.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            AI-powered guitar effects that understand what you mean.
            Skip the knob-tweaking — just describe the sound you want.
          </p>

          {/* Prompt Demo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="max-w-2xl mx-auto mb-12"
          >
            <div className="bg-glass rounded-2xl p-1 glow-primary">
              <div className="flex items-center gap-3 bg-background/80 rounded-xl px-5 py-4">
                <Zap className="w-5 h-5 text-primary shrink-0" />
                <span className="font-mono text-base sm:text-lg text-foreground flex-1 text-left">
                  {displayText}
                  <span className="inline-block w-0.5 h-5 bg-primary ml-0.5 animate-pulse-glow align-middle" />
                </span>
                <button className="shrink-0 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all">
                  Generate
                </button>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center justify-center gap-8 sm:gap-12 text-sm text-muted-foreground"
          >
            <div>
              <span className="block text-2xl font-bold text-foreground">50+</span>
              Effect Styles
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <span className="block text-2xl font-bold text-foreground">&lt;10ms</span>
              Latency
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <span className="block text-2xl font-bold text-foreground">80%+</span>
              First-try Accept
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
