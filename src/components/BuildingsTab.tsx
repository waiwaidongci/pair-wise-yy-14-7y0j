import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, type FormValues } from "../store";
import type { ComponentRec, Joint, Kind } from "../types";
import { SeverityBadge, StatusBadge, Badge, RetestForm } from "./ui";
import { severityOf } from "../engine";

const KINDS: Kind[] = ["梁架", "柱网", "斗拱"];
const JOINTS: Joint[] = ["燕尾榫", "透榫", "半榫", "箍头榫", "直榫", "斗口榫"];

const EMPTY: FormValues = {
  code: "",
  kind: "梁架",
  species: "",
  joint: "",
  section: "",
  disease: "",
  deformation: 0,
  retest: 0,
  marker: { x: 50, y: 60 },
};

/** 建筑立面示意图（病害标记点选底图） */
function ElevationPicker({
  marker,
  onChange,
}: {
  marker: { x: number; y: number };
  onChange: (m: { x: number; y: number }) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const pick = (ev: React.MouseEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    onChange({ x: Math.min(96, Math.max(4, x)), y: Math.min(92, Math.max(8, y)) });
  };
  return (
    <svg ref={ref} viewBox="0 0 200 150" className="elevation-picker" onClick={pick}>
      <line x1="0" y1="140" x2="200" y2="140" stroke="#94a3b8" strokeWidth="3" />
      <rect x="10" y="30" width="180" height="10" rx="2" fill="#854d0e" />
      <rect x="14" y="20" width="172" height="10" rx="2" fill="#a16207" />
      {[30, 100, 170].map((x) => (
        <g key={x}>
          <rect x={x - 4} y="40" width="8" height="100" fill="#475569" />
          <rect x={x - 7} y="32" width="14" height="8" rx="1" fill="#0f766e" />
        </g>
      ))}
      <circle
        cx={(marker.x / 100) * 200}
        cy={(marker.y / 100) * 150}
        r="7"
        fill="#dc2626"
        stroke="#fff"
        strokeWidth="2"
      />
    </svg>
  );
}

export function BuildingsTab({ onSelectComponent }: { onSelectComponent?: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const buildingId = state.selectedBuildingId;
  const building = state.buildings.find((b) => b.id === buildingId);

  const [kindFilter, setKindFilter] = useState<Kind | "">("");
  const [jointFilter, setJointFilter] = useState<Joint | "">("");
  const [keyword, setKeyword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY);
  const [formConflict, setFormConflict] = useState<string | null>(null);
  const seenConflicts = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const c of state.conflicts) {
      if (seenConflicts.current.has(c.id)) continue;
      seenConflicts.current.add(c.id);
      if (c.componentId && c.componentId === editingId) {
        setFormConflict(`${c.by} 先提交成功（${c.detail}）。你表单中的现场值已保留，可基于最新版本重新提交。`);
      }
    }
  }, [state.conflicts, editingId]);

  const list = useMemo(() => {
    return state.components.filter((c) => {
      if (c.buildingId !== buildingId) return false;
      if (kindFilter && c.kind !== kindFilter) return false;
      if (jointFilter && c.joint !== jointFilter) return false;
      if (keyword && !c.code.includes(keyword) && !c.disease.includes(keyword)) return false;
      return true;
    });
  }, [state.components, buildingId, kindFilter, jointFilter, keyword]);

  const startAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setFormConflict(null);
  };

  const startEdit = (c: ComponentRec) => {
    setEditingId(c.id);
    setFormConflict(null);
    setForm({
      code: c.code,
      kind: c.kind,
      species: c.species,
      joint: c.joint,
      section: c.section,
      disease: c.disease,
      deformation: c.deformation,
      retest: c.retest,
      marker: { ...c.marker },
    });
  };

  const submit = () => {
    if (!form.code.trim()) {
      alert("请填写构件编号");
      return;
    }
    if (editingId) {
      const c = state.components.find((x) => x.id === editingId);
      dispatch({
        type: "UPDATE_COMPONENT",
        id: editingId,
        baseVersion: c?.version ?? 1,
        patch: { ...form },
        summary: `修改 ${form.code}：${form.species}·${form.joint || "未填榫型"}·${form.section}·${form.disease}`,
      });
    } else {
      dispatch({ type: "ADD_COMPONENT", buildingId, values: form });
    }
  };

  const latest = editingId ? state.components.find((x) => x.id === editingId) : null;

  return (
    <div className="tab-grid">
      <section className="panel">
        <div className="heading">
          <div>
            <p>{building?.name} · 构件清单</p>
            <h2>构件登记</h2>
          </div>
          <div className="inline-tools">
            <select
              value={buildingId}
              onChange={(e) => dispatch({ type: "SELECT_BUILDING", id: e.target.value })}
            >
              {state.buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const name = prompt("新增建筑名称");
                if (name) dispatch({ type: "ADD_BUILDING", name });
              }}
            >
              + 新建筑
            </button>
          </div>
        </div>

        <div className="chips">
          <button className={kindFilter === "" ? "active" : ""} onClick={() => setKindFilter("")}>
            全部
          </button>
          {KINDS.map((k) => (
            <button key={k} className={kindFilter === k ? "active" : ""} onClick={() => setKindFilter(k)}>
              {k}
            </button>
          ))}
        </div>
        <div className="chips">
          <span className="chip-label">榫卯</span>
          <button className={jointFilter === "" ? "active" : ""} onClick={() => setJointFilter("")}>
            全部
          </button>
          {JOINTS.map((j) => (
            <button key={j} className={jointFilter === j ? "active" : ""} onClick={() => setJointFilter(j)}>
              {j}
            </button>
          ))}
          <input
            className="keyword"
            placeholder="搜索编号 / 病害位置"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="component-list">
          {list.length === 0 && <p className="empty">当前筛选下无构件</p>}
          {list.map((c) => (
            <article key={c.id} className={editingId === c.id ? "selected" : ""}>
              <b className={`kind-tag kind-${c.kind}`}>{c.kind}</b>
              <div className="component-main" onClick={() => onSelectComponent?.(c.id)}>
                <h3>
                  {c.code} <StatusBadge status={c.status} />
                  {c.dirty && <Badge tone="amber">待核对</Badge>}
                </h3>
                <p>
                  {c.species} · {c.joint || "未填榫型"} · {c.section} · {c.disease}
                </p>
                <p className="component-meta">
                  变形 {c.deformation}mm → 复测 {c.retest}mm · <SeverityBadge deformation={c.retest} /> · v{c.version}
                  {c.rec && (
                    <Badge tone={c.rec.valid ? "green" : "red"}>
                      建议{c.rec.valid ? "有效" : "失效"}·{c.rec.level}
                    </Badge>
                  )}
                </p>
                <RetestForm c={c} />
              </div>
              <button onClick={() => startEdit(c)}>编辑</button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel form-panel">
        <div className="heading">
          <div>
            <p>专业字段</p>
            <h2>{editingId ? `编辑构件 ${latest?.code ?? ""}` : "新增构件"}</h2>
          </div>
          <Badge tone="slate">{editingId ? `基于 v${latest?.version ?? 1} 提交` : "登记后进入抢护队列"}</Badge>
        </div>

        {formConflict && (
          <div className="conflict-banner">
            <strong>写入冲突，现场值已保留</strong>
            <p>{formConflict}</p>
            <button
              onClick={() => {
                if (latest) {
                  setForm({
                    code: latest.code,
                    kind: latest.kind,
                    species: latest.species,
                    joint: latest.joint,
                    section: latest.section,
                    disease: latest.disease,
                    deformation: latest.deformation,
                    retest: latest.retest,
                    marker: { ...latest.marker },
                  });
                  setFormConflict(null);
                }
              }}
            >
              以服务器最新值重填
            </button>
          </div>
        )}

        <div className="field-grid">
          <label>
            <span>构件编号</span>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 梁架A-03" />
          </label>
          <label>
            <span>构件种类</span>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>木材种类</span>
            <input value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} placeholder="如 杉木 / 楠木" />
          </label>
          <label>
            <span>榫卯类型</span>
            <select value={form.joint} onChange={(e) => setForm({ ...form, joint: e.target.value as Joint })}>
              <option value="">未填</option>
              {JOINTS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>截面尺寸</span>
            <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="如 180×240mm" />
          </label>
          <label>
            <span>病害位置</span>
            <input value={form.disease} onChange={(e) => setForm({ ...form, disease: e.target.value })} placeholder="如 梁端开裂 / 柱脚糟朽" />
          </label>
          <label>
            <span>变形情况（mm）</span>
            <input type="number" min="0" step="0.1" value={form.deformation} onChange={(e) => setForm({ ...form, deformation: Number(e.target.value) })} />
          </label>
          <label>
            <span>复测值（mm）</span>
            <input type="number" min="0" step="0.1" value={form.retest} onChange={(e) => setForm({ ...form, retest: Number(e.target.value) })} />
          </label>
        </div>

        <div className="marker-row">
          <div>
            <span className="field-label">病害位置标记（点选立面图）</span>
            <ElevationPicker marker={form.marker} onChange={(m) => setForm({ ...form, marker: m })} />
            <p className="marker-hint">
              当前：x {form.marker.x.toFixed(0)}% · y {form.marker.y.toFixed(0)}%
              （{severityOf(form.retest)}）
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button className="primary" onClick={submit}>
            {editingId ? "提交修改" : "登记构件"}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
                setFormConflict(null);
              }}
            >
              取消编辑
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
