import { useState } from "react";
import type { AppState, ComponentNode, Mortise } from "../domain/types";
import {
  DISEASE_LABEL,
  KIND_LABEL,
  MORTISES,
  SEVERITY_LABEL,
  STATUS_LABEL,
  WOODS,
} from "../domain/types";
import { deriveAdvice, deriveDiseases, isStale, measureSignature } from "../domain/engine";
import {
  claimComponent,
  claimSlot,
  completeComponent,
  releaseComponent,
  saveSurvey,
  verifyComponent,
} from "../domain/store";
import DiseaseMap from "./DiseaseMap";

interface Props {
  state: AppState;
  component: ComponentNode;
  surveyor: string;
}

export default function ComponentDetail({ state, component, surveyor }: Props) {
  const building = state.buildings.find((b) => b.id === component.buildingId);
  const [draft, setDraft] = useState({
    wood: component.wood,
    mortise: component.mortise,
    reWidth: component.reWidth,
    reHeight: component.reHeight,
    reDeflection: component.reDeflection,
    diseaseLocation: component.diseaseLocation,
  });
  const [slotPick, setSlotPick] = useState(1);
  const [notice, setNotice] = useState<{ type: "conflict" | "ok"; text: string } | null>(null);

  // 切换构件时由父级以 key 重挂载，草稿自然重置
  const draftComponent: ComponentNode = { ...component, ...draft };
  const preview = deriveDiseases(draftComponent);
  const previewAdvice = deriveAdvice(draftComponent);
  const dirty = measureSignature(draftComponent) !== measureSignature(component);
  const stale = isStale(component);
  const mine = component.lockedBy === surveyor;
  const lockedByOther = !!component.lockedBy && !mine;

  const update = (patch: Partial<typeof draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNotice(null);
  };

  const handleSaveSurvey = () => {
    saveSurvey(component.id, draft);
    setNotice({
      type: "ok",
      text: dirty
        ? "复测值已改动：旧版修缮建议失效，病害标记与传力边已重算，请重新核对。"
        : "复测记录已保存，值未发生变化。",
    });
  };

  const handleVerify = () => {
    if (dirty) {
      setNotice({ type: "conflict", text: "表单里还有未保存的复测值，请先保存再核对。" });
      return;
    }
    verifyComponent(component.id, surveyor);
    setNotice({ type: "ok", text: "已按当前复测值封存新版本，构件回到抢护队列。" });
  };

  const handleClaim = () => {
    const r = claimComponent(component.id, surveyor, {
      reDeflection: draft.reDeflection,
      reWidth: draft.reWidth,
      reHeight: draft.reHeight,
    });
    if (!r.ok && r.conflict) {
      setNotice({
        type: "conflict",
        text: `冲突：${r.conflict.winner} 已先处理该构件，你的现场值已保留在冲突记录中，未入库。`,
      });
    } else if (r.ok) {
      setNotice({ type: "ok", text: "占位成功，支撑位已分配，可以开工抢护。" });
    }
  };

  const handleClaimSlot = () => {
    const r = claimSlot(component.id, slotPick, surveyor, {
      reDeflection: draft.reDeflection,
      reWidth: draft.reWidth,
      reHeight: draft.reHeight,
    });
    if (!r.ok && r.conflict) {
      setNotice({
        type: "conflict",
        text: `冲突：支撑位 ${slotPick} 已被 ${r.conflict.winner} 先占用，现场值保留、未入库。`,
      });
    } else if (r.ok) {
      setNotice({ type: "ok", text: `已占用支撑位 ${slotPick}。` });
    }
  };

  return (
    <div className="detail" key={component.id}>
      <div className="detail-head">
        <div>
          <p className="eyebrow">{building?.name} · {KIND_LABEL[component.kind]}</p>
          <h3>{component.code}</h3>
        </div>
        <div className="badges">
          <span className={`status status-${component.status}`}>{STATUS_LABEL[component.status]}</span>
          <span className={`sev sev-${preview.severity}`}>{SEVERITY_LABEL[preview.severity]}</span>
          {stale && <span className="stale-badge">建议已失效 · 待重新核对</span>}
        </div>
      </div>

      <div className="detail-grid">
        <div className="survey-form">
          <h4>复测登记</h4>
          <div className="form-row">
            <label>
              <span>木材种类</span>
              <select value={draft.wood} onChange={(e) => update({ wood: e.target.value })}>
                {WOODS.map((w) => <option key={w}>{w}</option>)}
              </select>
            </label>
            <label>
              <span>榫卯类型</span>
              <select
                value={draft.mortise}
                onChange={(e) => update({ mortise: e.target.value as Mortise })}
              >
                {MORTISES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row three">
            <label>
              <span>截面宽 mm</span>
              <input
                type="number"
                value={draft.reWidth}
                onChange={(e) => update({ reWidth: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>截面高 mm</span>
              <input
                type="number"
                value={draft.reHeight}
                onChange={(e) => update({ reHeight: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>复测变形 mm</span>
              <input
                type="number"
                step="0.1"
                value={draft.reDeflection}
                onChange={(e) => update({ reDeflection: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="full">
            <span>病害位置</span>
            <input
              value={draft.diseaseLocation}
              onChange={(e) => update({ diseaseLocation: e.target.value })}
            />
          </label>
          <div className="hint-line">
            登记值：{component.width}×{component.height}mm / 初测变形 {component.deflection}mm
            {dirty && <em className="dirty-flag">● 表单有未保存改动</em>}
          </div>
          <div className="actions">
            <button className="primary" onClick={handleSaveSurvey}>保存复测值</button>
            {(component.status === "unverified" || stale) && (
              <button onClick={handleVerify}>重新核对并入队</button>
            )}
          </div>
          {notice && (
            <div className={`notice notice-${notice.type === "ok" ? "ok" : "conflict"}`}>
              {notice.text}
            </div>
          )}

          <div className="advice-box">
            <h4>修缮建议{component.currentVersion ? `（v${component.currentVersion.version}${stale ? " 已失效" : " 生效"}）` : "（尚未核对）"}</h4>
            {component.currentVersion && !stale && (
              <p className="advice-current">{component.currentVersion.advice}</p>
            )}
            <div className={`advice-preview ${!component.currentVersion || stale ? "live" : ""}`}>
              <span className="preview-label">
                {dirty ? "按当前表单预览" : component.currentVersion && !stale ? "当前复测值再算结果" : "待核对建议预览"}
              </span>
              <p>{previewAdvice}</p>
              <div className="disease-tags">
                {preview.diseases.map((d) => (
                  <span key={d} className={`tag tag-${d}`}>{DISEASE_LABEL[d]}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="side-col">
          <h4>病害标记图</h4>
          <DiseaseMap component={draftComponent} />

          <h4>支撑位与抢护</h4>
          <div className="slot-box">
            <div className="slot-row">
              <span>{building?.name} 临时支撑位</span>
              <strong>
                {state.components.filter((c) => c.buildingId === building?.id && c.status === "processing").length}
                /{building?.slotCount} 占用
              </strong>
            </div>
            {component.status === "processing" && (
              <p className="lock-line">
                {mine ? `你（${surveyor}）占用 #${component.assignedSlot}` : `${component.lockedBy} 正占用 #${component.assignedSlot}`}
              </p>
            )}
            {lockedByOther && <p className="conflict-line">该构件正由 {component.lockedBy} 处理，先处理者生效。</p>}
            <div className="actions">
              {(component.status === "waiting") && !stale && (
                <>
                  <button className="primary" onClick={handleClaim} disabled={lockedByOther}>
                    开工占位（自动分配）
                  </button>
                  <span className="slot-pick">
                    指定
                    <input type="number" min={1} max={building?.slotCount} value={slotPick}
                      onChange={(e) => setSlotPick(Number(e.target.value))} />
                    位
                    <button onClick={handleClaimSlot} disabled={lockedByOther}>占用</button>
                  </span>
                </>
              )}
              {component.status === "processing" && mine && (
                <>
                  <button className="primary" onClick={() => completeComponent(component.id, surveyor)}>
                    完成修缮并释放
                  </button>
                  <button onClick={() => releaseComponent(component.id, surveyor)}>中途退出回候队</button>
                </>
              )}
              {component.status === "unverified" && <p className="hint-line">核对封存建议后，方可进入抢护队列。</p>}
              {stale && <p className="hint-line">复测值已变，重新核对后才会回到抢护队列。</p>}
              {component.status === "done" && <p className="hint-line">修缮完成，支撑位已释放。</p>}
            </div>
          </div>
        </div>
      </div>

      <h4>旧版留档（{component.history.length} 个版本）</h4>
      {component.history.length === 0 && <p className="hint-line">暂无已核对版本。</p>}
      <ul className="version-list">
        {[...component.history].reverse().map((v) => (
          <li key={v.version} className={component.currentVersion?.version === v.version && !stale ? "ver-current" : "ver-old"}>
            <div className="ver-head">
              <strong>v{v.version}</strong>
              <span>{new Date(v.createdAt).toLocaleString("zh-CN")}</span>
              <span>核对人 {v.surveyor}</span>
              <span>变形 {v.reDeflection}mm</span>
              {component.currentVersion?.version === v.version && !stale && <em className="ver-badge">生效中</em>}
              {(component.currentVersion?.version !== v.version || stale) && <em className="ver-badge old">旧版</em>}
            </div>
            <p>{v.advice}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
