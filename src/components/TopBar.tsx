import { useStore } from "../store";

export function TopBar() {
  const { state, dispatch } = useStore();
  const me = state.surveyors.find((s) => s.id === state.currentSurveyorId);

  return (
    <header className="topbar">
      <div className="topbar-id">
        <p>木结构榫卯构件测绘 · 抢护台</p>
        <h1>古建灾后抢护续作台</h1>
        <span>
          登记木材种类、构件编号、病害位置、榫卯类型、截面尺寸与变形；连梁架、柱网、斗拱的传力关系。
          复测值一变，建议失效、关系边与病害标记重算，重新核对才回到抢护队列。
        </span>
      </div>
      <div className="topbar-tools">
        <div className="surveyor-switch" role="group" aria-label="测绘员切换">
          <span className="tool-label">当前作业</span>
          {state.surveyors.map((s) => (
            <button
              key={s.id}
              className={s.id === state.currentSurveyorId ? "active" : ""}
              onClick={() => dispatch({ type: "SWITCH_SURVEYOR", id: s.id })}
            >
              {s.name}
            </button>
          ))}
        </div>
        <span className="autosave">
          <span className="dot" />
          已自动保存 · 关闭页面后队列 / 旧版 / 未完成处理仍在
        </span>
        <button
          className="ghost-danger"
          onClick={() => {
            if (confirm("确定清空全部抢护台数据并重置为示例？队列、旧版与草稿将一并清除。")) {
              dispatch({ type: "RESET" });
            }
          }}
        >
          重置数据
        </button>
      </div>
      <p className="topbar-foot">
        {me?.name} 正在作业 · 数据键位 <code>gujian-rescue-desk:v1</code>（localStorage 持久化，可随时关闭后续作）
      </p>
    </header>
  );
}
