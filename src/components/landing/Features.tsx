import { motion } from "framer-motion";
import { Mic, Sliders, Layers, Gauge, Share2, Sparkles } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "Natural Language Prompts",
    description: "Describe your tone in plain English. Our NLP model trained on thousands of gear descriptions understands you.",
  },
  {
    icon: Sliders,
    title: "Intuitive Fine-Tuning",
    description: "Adjust with simple 'more/less' controls or re-prompt the AI. No parameter names to memorize.",
  },
  {
    icon: Gauge,
    title: "Sub-10ms Latency",
    description: "Studio-grade 24-bit/48kHz processing in real-time. Play live with zero perceptible lag.",
  },
  {
    icon: Layers,
    title: "50+ Effect Styles",
    description: "From warm blues to heavy metal crunch. Rock, jazz, electronic, ambient — every genre covered.",
  },
  {
    icon: Mic,
    title: "Voice Input",
    description: "Speak your tone description hands-free while you play. The AI listens and dials it in.",
  },
  {
    icon: Share2,
    title: "Community Presets",
    description: "Share your creations, discover new tones, and build on what others have made.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Features = () => {
  return (
    <section className="py-32 relative">
      <div className="container px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Built for <span className="text-gradient-primary">producers</span>,
            <br />not engineers.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Stop spending hours tweaking knobs. Start making music.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              className="group bg-glass rounded-2xl p-6 hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mb-4 group-hover:glow-primary transition-shadow duration-300">
                <f.icon className="w-5 h-5 text-accent-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
