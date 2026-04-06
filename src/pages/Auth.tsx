import { useState } from "react";
import { motion } from "framer-motion";
import { Guitar, Mail, Lock, ArrowRight, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [authMethod, setAuthMethod] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMethod === "code") {
        if (!codeSent) {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/studio`,
              shouldCreateUser: !isLogin,
            },
          });
          if (error) throw error;
          setCodeSent(true);
          toast.success("Authentication code sent to your email.");
        } else {
          const { error } = await supabase.auth.verifyOtp({
            email,
            token: code.trim(),
            type: "email",
          });
          if (error) throw error;
          toast.success("Signed in successfully.");
          navigate("/studio");
        }
      } else {
        if (isLogin) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          navigate("/studio");
        } else {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/studio` },
          });
          if (error) throw error;
          toast.success("Sign-up created. Check your email to confirm.");
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/studio`,
    });
    if (result && 'error' in result && result.error) {
      toast.error(String(result.error));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2 mb-4">
            <Guitar className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg text-foreground">ToneForge</span>
          </a>
          <h1 className="text-2xl font-bold text-foreground">
            {isLogin ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? "Sign in to your studio" : "Start crafting your sound"}
          </p>
        </div>

        <div className="bg-glass rounded-2xl p-6 space-y-4">
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            <span>or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => { setAuthMethod("password"); setCodeSent(false); setCode(""); }}
                className={`px-3 py-2 rounded-lg ${authMethod === "password" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setAuthMethod("code"); setPassword(""); }}
                className={`px-3 py-2 rounded-lg ${authMethod === "code" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Email Code
              </button>
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground/50"
              />
            </div>
            {authMethod === "password" ? (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground/50"
                />
              </div>
            ) : codeSent ? (
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit email code"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground/50"
                />
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading
                ? "Loading..."
                : authMethod === "code"
                  ? codeSent
                    ? "Verify Code"
                    : "Send Code"
                  : isLogin
                    ? "Sign In"
                    : "Sign Up"}
              <ArrowRight className="w-4 h-4" />
            </button>
            {authMethod === "code" && codeSent && (
              <button
                type="button"
                onClick={() => setCodeSent(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Send a new code
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
