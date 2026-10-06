import { useEffect, useState, type ReactNode } from "react";
import type { ComponentRec, Status } from "../types";
import { severityOf, SEVERITY_COLOR } from "../engine";
import { useStore } from "../store";

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" | "red" | "green" | "blue" | "purple" }) {
  const tones: Record<string, { bg: string; fg: string; bd: string }> = {
    slate: { bg: "#f1f5f9", fg: "#475569", bd: "#cbd5e1" },
    amber: { bg: "#fef3c7", fg: "#b45309", bd: "#fcd34d" },
    red: { bg: "#fee2e2", fg: "#b91c1c", bd: "#fca5a5" },
    green: { bg: "#d1fae5", fg: "#047857", bd: "#6ee7b7" },
    blue: { bg: "#dbeafe", fg: "#1d4ed8", bd: "#93c5fd" },
    purple: { bg: "#ede9fe", fg: "#6d28d9", bd: "#c4b5fd" },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; tone: "slate" | "blue" | "amber" | "green" }> = {
    registered: { label: "已登记", tone: "slate" },
    queued: { label: "抢护队列", tone: "blue" },
    processing: { label: "处理中", tone: "amber" },
    rescued: { label: "已抢护", tone: "green" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function SeverityBadge({ deformation }: { deformation: number }) {
  const s = severityOf(deformation);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: SEVERITY_COLOR[s] }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: SEVERITY_COLOR[s], display: "inline-block" }} />
      {s}
    </span>
  );
}

export function SectionTitle({ kicker, title, extra }: { kicker?: string; title: string; extra?: ReactNode }) {
  return (
    <div className="heading">
      <div>
        {kicker && <p>{kicker}</p>}
        <h2>{title}</h2>
      </div>
      {extra}
    </div>
  );
}

/** 复测值录入：提交后修缮建议失效、关系边与病害标记待重算，构件退出抢护队列 */
export function RetestForm({ c }: { c: ComponentRec }) {
  const { dispatch } = useStore();
  const [val, setVal] = useState(c.retest);
  useEffect(() => setVal(c.retest), [c.retest]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number.isNaN(val) || val < 0) return;
    dispatch({ type: "RETEST", id: c.id, baseVersion: c.version, retest: val });
  };

  return (
    <form
      className="retest-form"
      onSubmit={submit}
      onClick={(e) => e.stopPropagation()}
    >
      <label>
        <span>复测值（mm）</span>
        <input
          type="number"
          step="0.1"
          min="0"
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
        />
      </label>
      <button type="submit">提交复测（建议失效·重算）</button>
    </form>
  );
}
