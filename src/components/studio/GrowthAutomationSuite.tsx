import { useMemo, useState } from "react";
import { BarChart3, Bot, Download, Mail, PlayCircle, Workflow } from "lucide-react";

type CreativeMetric = {
  name: string;
  ctr: number;
  cpc: number;
  retention: number;
};

const KPI_BENCHMARKS = {
  costPerResult: 18,
  costPerLinkClick: 1.8,
  ctr: 1.6,
  videoRetention: 35,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function exportTextReport(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const GrowthAutomationSuite = () => {
  const [crmContext, setCrmContext] = useState("");
  const [outreachGoal, setOutreachGoal] = useState("Book call for producer demo");
  const [workflowMode, setWorkflowMode] = useState<"dashboard" | "api">("dashboard");
  const [workflowStep, setWorkflowStep] = useState("");
  const [workflowSteps, setWorkflowSteps] = useState<string[]>([
    "Trigger: New lead in CRM",
    "AI: Draft outreach email",
    "Approval: Team lead review",
    "Action: Send + log to CRM",
  ]);
  const [creativeInput, setCreativeInput] = useState(
    "Creative A|1.9|1.4|41\nCreative B|1.2|2.2|30\nCreative C|2.4|1.1|48",
  );
  const [analysisPrompt, setAnalysisPrompt] = useState("Prioritize punchy hooks for 18-25 producers.");
  const [kpis, setKpis] = useState({
    costPerResult: 17,
    costPerLinkClick: 1.6,
    ctr: 1.8,
    videoRetention: 38,
    variantA: 1.6,
    variantB: 2.0,
  });

  const outreachDraft = useMemo(() => {
    if (!crmContext.trim()) return "";
    return [
      `Subject: Quick win for ${outreachGoal.toLowerCase()}`,
      "",
      `Hi there, I checked your recent campaign notes: ${crmContext.slice(0, 180)}${crmContext.length > 180 ? "..." : ""}`,
      "",
      "You can cut manual audio iteration time by auto-generating tone-ready outputs and remix versions.",
      "If helpful, I can send a 10-minute walkthrough tailored to your current workflow.",
      "",
      "Best,",
      "ToneForge Team",
      "",
      "Approval workflow: Draft -> Reviewer -> Final send",
    ].join("\n");
  }, [crmContext, outreachGoal]);

  const creativeScores = useMemo(() => {
    const rows = creativeInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line): CreativeMetric | null => {
        const [name, ctr, cpc, retention] = line.split("|").map((v) => v.trim());
        if (!name || !ctr || !cpc || !retention) return null;
        return {
          name,
          ctr: Number(ctr),
          cpc: Number(cpc),
          retention: Number(retention),
        };
      })
      .filter((row): row is CreativeMetric => !!row && !Number.isNaN(row.ctr) && !Number.isNaN(row.cpc) && !Number.isNaN(row.retention));

    return rows
      .map((row) => {
        const score = clamp(row.ctr * 40 + (3 - row.cpc) * 25 + row.retention * 0.8, 0, 100);
        return { ...row, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [creativeInput]);

  const kpiRows = useMemo(() => {
    return [
      { key: "costPerResult", label: "Cost / Result", value: kpis.costPerResult, benchmark: KPI_BENCHMARKS.costPerResult, better: "lower" as const },
      { key: "costPerLinkClick", label: "Cost / Link Click", value: kpis.costPerLinkClick, benchmark: KPI_BENCHMARKS.costPerLinkClick, better: "lower" as const },
      { key: "ctr", label: "CTR %", value: kpis.ctr, benchmark: KPI_BENCHMARKS.ctr, better: "higher" as const },
      { key: "videoRetention", label: "Video Retention %", value: kpis.videoRetention, benchmark: KPI_BENCHMARKS.videoRetention, better: "higher" as const },
    ];
  }, [kpis]);

  const abLift = ((kpis.variantB - kpis.variantA) / Math.max(kpis.variantA, 0.01)) * 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-glass rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Hyper-Personalized Email Automation
          </h3>
          <textarea
            value={crmContext}
            onChange={(e) => setCrmContext(e.target.value)}
            placeholder="Paste CRM context (lead source, pain points, last touchpoint...)"
            className="w-full h-24 rounded-xl bg-muted px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/40"
          />
          <input
            value={outreachGoal}
            onChange={(e) => setOutreachGoal(e.target.value)}
            className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/40"
          />
          <div className="rounded-xl border border-border/60 bg-background/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Draft + Approval Path</p>
            <pre className="text-xs whitespace-pre-wrap font-mono text-foreground/90">{outreachDraft || "Enter CRM context to generate outreach draft."}</pre>
          </div>
          <button
            onClick={() => exportTextReport("outreach-draft.txt", outreachDraft || "No draft generated")}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-2"
          >
            <Download className="w-3 h-3" /> Export Draft
          </button>
        </section>

        <section className="bg-glass rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Workflow className="w-4 h-4 text-secondary" /> Workflow Automation Buildout
          </h3>
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setWorkflowMode("dashboard")}
              className={`px-3 py-1.5 rounded-full ${workflowMode === "dashboard" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              Dashboard-first
            </button>
            <button
              onClick={() => setWorkflowMode("api")}
              className={`px-3 py-1.5 rounded-full ${workflowMode === "api" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              API-first
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={workflowStep}
              onChange={(e) => setWorkflowStep(e.target.value)}
              placeholder="Add a modular step"
              className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none focus:ring-2 ring-secondary/40"
            />
            <button
              onClick={() => {
                if (!workflowStep.trim()) return;
                setWorkflowSteps((prev) => [...prev, workflowStep.trim()]);
                setWorkflowStep("");
              }}
              className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold"
            >
              Add
            </button>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-1">
            {workflowSteps.map((step, idx) => (
              <p key={`${step}-${idx}`} className="text-xs text-foreground/90">{idx + 1}. {step}</p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Deployment style: <span className="font-medium text-foreground">{workflowMode === "dashboard" ? "Visual orchestration" : "Composable endpoints + webhooks"}</span>
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-glass rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> AI-Based Ad Analysis
          </h3>
          <textarea
            value={creativeInput}
            onChange={(e) => setCreativeInput(e.target.value)}
            className="w-full h-24 rounded-xl bg-muted px-3 py-2 text-xs font-mono outline-none focus:ring-2 ring-primary/40"
          />
          <input
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/40"
          />
          <div className="space-y-2">
            {creativeScores.map((creative, index) => (
              <div key={creative.name} className="rounded-lg border border-border/60 p-2 text-xs">
                <p className="font-semibold text-foreground">#{index + 1} {creative.name} - Score {creative.score.toFixed(1)}</p>
                <p className="text-muted-foreground">
                  Next action: {index === 0 ? "Scale budget + clone variation" : index === 1 ? "Test new hook intro" : "Pause or rework creative"}
                </p>
              </div>
            ))}
            {creativeScores.length === 0 && <p className="text-xs text-muted-foreground">Use format: Name|CTR|CPC|Retention</p>}
          </div>
          <button
            onClick={() => exportTextReport("creative-analysis.txt", `Prompt: ${analysisPrompt}\n\n${creativeScores.map((c, i) => `${i + 1}. ${c.name} (${c.score.toFixed(1)})`).join("\n")}`)}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-2"
          >
            <Download className="w-3 h-3" /> Export Report
          </button>
        </section>

        <section className="bg-glass rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bot className="w-4 h-4 text-secondary" /> KPI Benchmarking + A/B Testing
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Cost/Result
              <input type="number" value={kpis.costPerResult} onChange={(e) => setKpis((prev) => ({ ...prev, costPerResult: Number(e.target.value) }))} className="mt-1 w-full rounded-lg bg-muted px-2 py-1.5 text-xs text-foreground" />
            </label>
            <label className="text-xs text-muted-foreground">Cost/Link Click
              <input type="number" value={kpis.costPerLinkClick} onChange={(e) => setKpis((prev) => ({ ...prev, costPerLinkClick: Number(e.target.value) }))} className="mt-1 w-full rounded-lg bg-muted px-2 py-1.5 text-xs text-foreground" />
            </label>
            <label className="text-xs text-muted-foreground">CTR %
              <input type="number" value={kpis.ctr} onChange={(e) => setKpis((prev) => ({ ...prev, ctr: Number(e.target.value) }))} className="mt-1 w-full rounded-lg bg-muted px-2 py-1.5 text-xs text-foreground" />
            </label>
            <label className="text-xs text-muted-foreground">Video Retention %
              <input type="number" value={kpis.videoRetention} onChange={(e) => setKpis((prev) => ({ ...prev, videoRetention: Number(e.target.value) }))} className="mt-1 w-full rounded-lg bg-muted px-2 py-1.5 text-xs text-foreground" />
            </label>
          </div>
          <div className="space-y-1">
            {kpiRows.map((row) => {
              const pass = row.better === "higher" ? row.value >= row.benchmark : row.value <= row.benchmark;
              return (
                <p key={row.key} className={`text-xs ${pass ? "text-secondary" : "text-destructive"}`}>
                  {row.label}: {row.value.toFixed(2)} vs benchmark {row.benchmark.toFixed(2)} ({pass ? "on-track" : "needs action"})
                </p>
              );
            })}
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-xs space-y-1">
            <p className="font-semibold text-foreground">Simple A/B Test (CTR)</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-muted-foreground">Variant A
                <input type="number" value={kpis.variantA} onChange={(e) => setKpis((prev) => ({ ...prev, variantA: Number(e.target.value) }))} className="mt-1 w-full rounded-lg bg-muted px-2 py-1.5 text-xs text-foreground" />
              </label>
              <label className="text-muted-foreground">Variant B
                <input type="number" value={kpis.variantB} onChange={(e) => setKpis((prev) => ({ ...prev, variantB: Number(e.target.value) }))} className="mt-1 w-full rounded-lg bg-muted px-2 py-1.5 text-xs text-foreground" />
              </label>
            </div>
            <p className={abLift >= 0 ? "text-secondary" : "text-destructive"}>
              Variant B lift: {abLift.toFixed(1)}%
            </p>
          </div>
          <button
            onClick={() => exportTextReport("kpi-benchmark-report.txt", `KPI Snapshot\n${kpiRows.map((r) => `${r.label}: ${r.value}`).join("\n")}\nA/B Lift: ${abLift.toFixed(1)}%`)}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold inline-flex items-center gap-2"
          >
            <PlayCircle className="w-3 h-3" /> Export KPI Snapshot
          </button>
        </section>
      </div>
    </div>
  );
};

export default GrowthAutomationSuite;
