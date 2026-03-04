import { useEffect, useState } from "react";
import { Settings, User } from "lucide-react";
import StudioLayout from "@/components/studio/StudioLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StudioSettings = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to save");
    else toast.success("Settings saved");
  };

  return (
    <StudioLayout>
      <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>

        <div className="bg-glass rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Account
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <p className="text-sm text-foreground font-mono">{user?.email}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 ring-primary/50"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="bg-glass rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            DAW Export Preferences
          </h2>
          <p className="text-xs text-muted-foreground">
            Default export format and project template settings will be available in a future update.
          </p>
        </div>

        <div className="bg-glass rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Coming Soon
          </h2>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• ReWire / AAX / AU plugin sync (v3)</li>
            <li>• Cloud processing backend</li>
            <li>• Community marketplace for effect presets</li>
          </ul>
        </div>
      </div>
    </StudioLayout>
  );
};

export default StudioSettings;
