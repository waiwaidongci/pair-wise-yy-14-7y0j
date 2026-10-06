"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/engine.ts
var engine_exports = {};
__export(engine_exports, {
  SEVERITY_COLOR: () => SEVERITY_COLOR,
  downstreamOf: () => downstreamOf,
  edgeStale: () => edgeStale,
  fmtTime: () => fmtTime,
  priorityOf: () => priorityOf,
  recFor: () => recFor,
  severityOf: () => severityOf
});
module.exports = __toCommonJS(engine_exports);
function severityOf(deformation) {
  if (deformation >= 15) return "\u4E25\u91CD";
  if (deformation >= 6) return "\u4E2D\u7B49";
  return "\u8F7B\u5FAE";
}
var SEVERITY_COLOR = {
  \u8F7B\u5FAE: "#0f766e",
  \u4E2D\u7B49: "#b45309",
  \u4E25\u91CD: "#b91c1c"
};
function recFor(c) {
  const d = c.retest;
  const disease = c.disease;
  const critical = /柱脚|糟朽|开裂|劈裂/.test(disease);
  let level;
  let text;
  if (d >= 15 || critical && d >= 10) {
    level = "\u7ACB\u5373\u652F\u9876";
    text = "\u53D8\u5F62\u8D85\u9650\u4E14\u75C5\u5BB3\u4F4D\u4E8E\u5173\u952E\u53D7\u529B\u90E8\u4F4D\uFF0C\u5EFA\u8BAE\u7ACB\u5373\u652F\u9876\u3001\u5378\u8F7D\u5E76\u66F4\u6362\u53D7\u635F\u6784\u4EF6";
  } else if (d >= 6 || critical || /歪闪|变形/.test(disease)) {
    level = "\u652F\u6491";
    text = "\u5EFA\u8BAE\u589E\u8BBE\u4E34\u65F6\u652F\u6491\u9650\u5236\u53D8\u5F62\u53D1\u5C55\uFF0C\u5F85\u590D\u6D4B\u7A33\u5B9A\u540E\u62E9\u671F\u66F4\u6362\u6784\u4EF6";
  } else if (d > 0) {
    level = "\u76D1\u6D4B";
    text = "\u53D8\u5F62\u5728\u5141\u8BB8\u8303\u56F4\u5185\uFF0C\u5EFA\u8BAE\u7EE7\u7EED\u76D1\u6D4B\u5E76\u52A0\u5BC6\u590D\u6D4B\u9891\u6B21";
  } else {
    level = "\u6B63\u5E38";
    text = "\u6784\u4EF6\u72B6\u6001\u826F\u597D\uFF0C\u6309\u5E38\u89C4\u5DE1\u68C0\u517B\u62A4";
  }
  return {
    level,
    text,
    valid: true,
    issuedAt: Date.now(),
    basis: { deformation: d, disease, joint: c.joint }
  };
}
function downstreamOf(edges, id) {
  const out = /* @__PURE__ */ new Set();
  const walk = (x) => {
    for (const e of edges) {
      if (e.from === x && !out.has(e.to)) {
        out.add(e.to);
        walk(e.to);
      }
    }
  };
  walk(id);
  return [...out];
}
function priorityOf(c, downstreamCount) {
  return c.retest * 2 + downstreamCount * 5 + (c.kind === "\u67F1\u7F51" ? 3 : 0);
}
function edgeStale(e, byId) {
  const a = byId.get(e.from);
  const b = byId.get(e.to);
  return !!a?.dirty || !!b?.dirty;
}
function fmtTime(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SEVERITY_COLOR,
  downstreamOf,
  edgeStale,
  fmtTime,
  priorityOf,
  recFor,
  severityOf
});
