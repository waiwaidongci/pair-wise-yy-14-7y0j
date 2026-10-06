import { useMemo, useState } from "react";
import { useStore } from "../store";
import { fmtTime } from "../engine";
import { Badge, SectionTitle } from "./ui";

const FIELD_LABELS: Record<string, string> = {
  code: "编号",
  kind: "种类",
  species: "木材",
  joint: "榫卯",
  section: "截面",
  disease: "病害",
  deformation: "变形",
  retest: "复测值",
  marker: "标记",
  status: "状态",
  rec: "建议",
};

function diffFields(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const out: string[] = [];
  for (const k of keys) {
    if (["updatedAt", "lockedAt", "version", "supportId", "lockedBy", "rec"].includes(k)) continue;
    const a = JSON.stringify(prev[k] ?? "");
    const b = JSON.stringify(next[k] ?? "");
    if (a !== b) {
      out.push(`${FIELD_LABELS[k] ?? k}：${truncate(a)} → ${truncate(b)}`);
    }
  }
  return out;
}

function truncate(s: string): string {
  const t = s.replace(/^"|"$/g, "");
  return t.length > 22 ? t.slice(0, 22) + "…" : t;
}

export function HistoryPanel({ onContinueDraft }: { onContinueDraft?: (componentId: string) => void }) {
  const { state, dispatch } = useStore();
  const [componentFilter, setComponentFilter] = useState<string>("all");
  const [tab, setTab] = useState<"versions" | "conflicts" | "drafts">("versions");

  const versions = useMemo(
    () =>
      componentFilter === "all"
        ? state.versions
        : state.versions.filter((v) => v.componentId === componentFilter),
    [state.versions, componentFilter]
  );

  const activeDrafts = state.drafts.filter((d) => {
    const c = state.components.find((x) => x.id === d.componentId);
    return c && c.status !== "rescued";
  });

  return (
    <section className="panel">
      <SectionTitle
        kicker="留痕"
        title="旧版 · 冲突 · 未完成处理"
        extra={
          <div className="inline-tools">
            <button className={tab === "versions" ? "primary" : ""} onClick={() => setTab("versions")}>
              旧版（{state.versions.length}）
            </button>
            <button className={tab === "conflicts" ? "primary" : ""} onClick={() => setTab("conflicts")}>
              冲突（{state.conflicts.length}）
            </button>
            <button className={tab === "drafts" ? "primary" : ""} onClick={() => setTab("drafts")}>
              未完成处理（{activeDrafts.length}）
            </button>
          </div>
        }
      />

      {tab === "versions" && (
        <>
          <div className="chips">
            <button className={componentFilter === "all" ? "active" : ""} onClick={() => setComponentFilter("all")}>
              全部
            </button>
            {state.components.map((c) => (
              <button
                key={c.id}
                className={componentFilter === c.id ? "active" : ""}
                onClick={() => setComponentFilter(c.id)}
              >
                {c.code}
              </button>
            ))}
          </div>
          <div className="version-list">
            {versions.map((v, i) => {
              const comp = state.components.find((c) => c.id === v.componentId);
              const prev = versions[i + 1]?.snapshot;
              const changes = prev ? diffFields(prev as unknown as Record<string, unknown>, v.snapshot as unknown as Record<string, unknown>) : [];
              return (
                <article key={v.id} className="version-row">
                  <b className="version-badge">v{v.version}</b>
                  <div className="version-main">
                    <h4>
                      {comp?.code ?? "已删除构件"} · <Badge tone="slate">{v.action}</Badge>
                      <span className="version-who">{v.by} · {fmtTime(v.at)}</span>
                    </h4>
                    <p>{v.summary}</p>
                    {changes.length > 0 && (
                      <p className="version-diff">{changes.join("；")}</p>
                    )}
                  </div>
                  {comp && v.version !== comp.version && (
                    <button onClick={() => dispatch({ type: "RESTORE_VERSION", versionId: v.id })}>
                      恢复此版
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {tab === "conflicts" && (
        <div className="version-list">
          {state.conflicts.length === 0 && <p className="empty">暂无冲突——并发写入时，先到者生效、后到者保留现场值并在此显示</p>}
          {state.conflicts.map((cf) => (
            <article key={cf.id} className="conflict-row">
              <b className="conflict-badge">冲突</b>
              <div className="version-main">
                <h4>
                  {cf.componentCode ?? cf.supportCode ?? "构件"} ·{" "}
                  <Badge tone="red">{cf.by} 未写入</Badge>
                  <span className="version-who">{fmtTime(cf.at)}</span>
                </h4>
                <p>{cf.detail}</p>
                <p className="kept-value">后到者现场值保留：{cf.kept}</p>
                <p className="winner">先到生效：{cf.winnerBy}</p>
              </div>
              <button onClick={() => dispatch({ type: "DISMISS_CONFLICT", id: cf.id })}>知道了</button>
            </article>
          ))}
        </div>
      )}

      {tab === "drafts" && (
        <div className="version-list">
          {activeDrafts.length === 0 && <p className="empty">没有未完成处理</p>}
          {activeDrafts.map((d) => {
            const c = state.components.find((x) => x.id === d.componentId);
            const who = state.surveyors.find((s) => s.id === d.surveyorId)?.name;
            return (
              <article key={d.id} className="version-row draft-row">
                <b className="version-badge draft">草稿</b>
                <div className="version-main">
                  <h4>
                    {c?.code} · <Badge tone="slate">{who}</Badge>
                    <span className="version-who">开始于 {fmtTime(d.startedAt)}</span>
                  </h4>
                  <p>{d.note || "（无备注，处理未完成）"}</p>
                  <p className="draft-hint">关闭页面后仍保留，可继续处理；完成抢护后草稿清除</p>
                </div>
                <div className="inline-tools">
                  {c && c.status !== "rescued" && (
                    <button className="primary" onClick={() => onContinueDraft?.(c.id)}>
                      继续处理
                    </button>
                  )}
                  <button className="ghost-danger" onClick={() => dispatch({ type: "DISCARD_DRAFT", id: d.id })}>
                    放弃草稿
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
