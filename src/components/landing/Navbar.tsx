import { motion } from "framer-motion";
import { Guitar } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/50"
    >
      <div className="container px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Guitar className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg text-foreground">ToneForge</span>
        </div>
        <div className="hidden sm:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </div>
        <button
          onClick={() => navigate("/studio")}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
        >
          Open Studio
        </button>
      </div>
    </motion.nav>
  );
};

export default Navbar;
