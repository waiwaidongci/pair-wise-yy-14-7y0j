import type { AppState } from "../domain/types";
import { dismissConflict } from "../domain/store";

export default function ConflictsPanel({ state }: { state: AppState }) {
  return (
    <div className="conflicts-panel">
      <div className="cp-head">
        <h4>并发冲突（{state.conflicts.length}）</h4>
        <span className="hint-line">两人同时处理同一构件或支撑位时，后到者在此看到记录，现场值已保留。</span>
      </div>
      {state.conflicts.length === 0 && (
        <p className="hint-line">暂无冲突。可在另一个浏览器标签页打开本页，以另一测绘员身份同时开工来模拟。</p>
      )}
      <ul className="conflict-list">
        {state.conflicts.map((cf) => {
          const building = state.buildings.find((b) => b.id === cf.buildingId);
          return (
            <li key={cf.id}>
              <div className="cf-top">
                <strong>{cf.kind === "slot" ? `支撑位 #${cf.slot} 抢占` : "构件处理冲突"}</strong>
                <span>{new Date(cf.at).toLocaleTimeString("zh-CN")}</span>
                <button onClick={() => dismissConflict(cf.id)}>清除</button>
              </div>
              <p>
                {building?.name} · {cf.componentCode}：
                <b>{cf.surveyor}</b> 后到，先处理者 <b>{cf.winner}</b> 已生效；
                后到者现场值保留为 变形 {cf.onSite.reDeflection}mm、截面 {cf.onSite.reWidth}×{cf.onSite.reHeight}mm，未覆盖现场数据。
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
