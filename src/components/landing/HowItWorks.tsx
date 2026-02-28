import { motion } from "framer-motion";

const steps = [
  {
    num: "01",
    title: "Describe your sound",
    desc: "Type or speak a prompt like 'gritty garage rock with spring reverb'. Our AI gets it.",
  },
  {
    num: "02",
    title: "Preview in real-time",
    desc: "Hear the effect applied instantly. View waveforms and A/B compare with your dry signal.",
  },
  {
    num: "03",
    title: "Tweak & save",
    desc: "Fine-tune with simple controls, save to your library, or share with the community.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-32 relative">
      <div className="container px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Three steps to your <span className="text-gradient-primary">perfect tone</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative text-center"
            >
              <span className="text-7xl font-bold text-gradient-primary opacity-20 block mb-4 font-mono">
                {s.num}
              </span>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-4 w-8 h-px bg-border" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
