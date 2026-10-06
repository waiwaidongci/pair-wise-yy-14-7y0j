import { useState } from "react";
import type { AppState, ComponentKind, Mortise } from "../domain/types";
import { KIND_LABEL, MORTISES, WOODS } from "../domain/types";
import { registerComponent } from "../domain/store";

interface Props {
  state: AppState;
  buildingId: string;
}

export default function RegisterForm({ state, buildingId }: Props) {
  const peers = state.components.filter((c) => c.buildingId === buildingId);
  const [form, setForm] = useState({
    code: "",
    kind: "beam" as ComponentKind,
    wood: "松木",
    mortise: "透榫" as Mortise,
    width: 160,
    height: 220,
    diseaseLocation: "",
    deflection: 0,
  });
  const [downIds, setDownIds] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleDown = (id: string) =>
    setDownIds((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const submit = () => {
    if (!form.code.trim()) return;
    registerComponent({ buildingId, ...form, downIds });
    setSaved(true);
    setForm({ ...form, code: "", diseaseLocation: "", deflection: 0 });
    setDownIds([]);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="register-form">
      <div className="form-row">
        <label className="grow">
          <span>构件编号</span>
          <input placeholder="如 梁架 L-D-02" value={form.code} onChange={(e) => set("code", e.target.value)} />
        </label>
        <label>
          <span>类别</span>
          <select value={form.kind} onChange={(e) => set("kind", e.target.value as ComponentKind)}>
            {(Object.keys(KIND_LABEL) as ComponentKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>木材种类</span>
          <select value={form.wood} onChange={(e) => set("wood", e.target.value)}>
            {WOODS.map((w) => <option key={w}>{w}</option>)}
          </select>
        </label>
        <label>
          <span>榫卯类型</span>
          <select value={form.mortise} onChange={(e) => set("mortise", e.target.value as Mortise)}>
            {MORTISES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label>
          <span>截面宽 mm</span>
          <input type="number" value={form.width} onChange={(e) => set("width", Number(e.target.value))} />
        </label>
        <label>
          <span>截面高 mm</span>
          <input type="number" value={form.height} onChange={(e) => set("height", Number(e.target.value))} />
        </label>
        <label>
          <span>初测变形 mm</span>
          <input type="number" step="0.1" value={form.deflection} onChange={(e) => set("deflection", Number(e.target.value))} />
        </label>
      </div>
      <label className="full">
        <span>病害位置</span>
        <input placeholder="如 东端端部开裂、柱脚糟朽" value={form.diseaseLocation}
          onChange={(e) => set("diseaseLocation", e.target.value)} />
      </label>

      <div className="down-pick">
        <span>传力下游构件（荷载传给谁）：</span>
        <div className="down-chips">
          {peers.filter((p) => p.kind !== form.kind).map((p) => (
            <button
              key={p.id}
              type="button"
              className={downIds.includes(p.id) ? "chip on" : "chip"}
              onClick={() => toggleDown(p.id)}
            >
              {p.code}
            </button>
          ))}
          {peers.filter((p) => p.kind !== form.kind).length === 0 && (
            <em className="hint-line">先登记下游构件，再回来连边。</em>
          )}
        </div>
      </div>

      <div className="actions">
        <button className="primary" onClick={submit} disabled={!form.code.trim()}>登记构件</button>
        {saved && <span className="ok-text">已登记，出现在下方清单（待核对）。</span>}
      </div>
    </div>
  );
}
