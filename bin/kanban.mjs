#!/usr/bin/env node
// ============================================================================
// dsh-team-ai 团队看板 CLI
//
// 维护 <repo>/docs/team/kanban.json（粗粒度：角色 ↔ 状态 ↔ 当前任务 ↔ 活动）。
// 所有写操作原子完成（tmp + rename），角色/流程通过本脚本登记状态，
// 避免直接手改 JSON 出错。Web GUI 看板面板（lib/client.js）只读消费该文件。
//
// 用法：
//   kanban task <slug> --title <标题> [--round N] [--phase <阶段>]   # 登记当前任务
//   kanban start <role> --task <slug> --activity <描述>              # 角色开工
//   kanban set <role> <status> [--task <slug>] [--activity <描述>]   # 设置状态
//   kanban done <role>                                               # 角色完成
//   kanban clear                                                     # 清空为全 idle（任务收尾）
//   kanban show [--json]                                             # 查看当前状态
//   kanban render [--out <path>]                                     # 生成自包含 HTML 看板
//
// 目标仓库解析：--repo <path> > KANBAN_REPO 环境变量 > git rev-parse --show-toplevel（cwd）
// 状态文件：<repo>/docs/team/kanban.json
//
// 状态值：idle | working | done | blocked
// ============================================================================

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROLES = [
  "team-pm",
  "team-pjm",
  "team-architect",
  "team-backend",
  "team-frontend",
  "team-qa",
  "team-reviewer",
  "team-orchestrator",
  "team-general",
];

const STATUSES = ["idle", "working", "done", "blocked"];
const FILE_NAME = "docs/team/kanban.json";

// ----- 参数解析 -----
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

// ----- 仓库/文件解析 -----
function resolveRepo(args) {
  if (args.repo) return resolve(args.repo);
  if (process.env.KANBAN_REPO) return resolve(process.env.KANBAN_REPO);
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (top) return top;
  } catch {
    /* 不在 git 仓库内时交由 --repo / KANBAN_REPO */
  }
  throw new Error("无法确定目标仓库：请用 --repo <path> 或设置 KANBAN_REPO");
}

function stateFile(repo) {
  return join(repo, FILE_NAME);
}

// ----- 状态读写（原子） -----
function blankState() {
  const now = new Date().toISOString();
  const roles = {};
  for (const role of ROLES) {
    roles[role] = { status: "idle", task: null, activity: "", since: now };
  }
  return { version: 1, updatedAt: now, currentTask: null, roles };
}

function loadState(file) {
  if (!existsSync(file)) return blankState();
  const raw = readFileSync(file, "utf8");
  try {
    const data = JSON.parse(raw);
    const base = blankState();
    // 合并：未知角色忽略，缺字段用默认
    for (const role of ROLES) {
      const entry = data.roles?.[role];
      if (entry && typeof entry === "object") {
        base.roles[role] = {
          status: STATUSES.includes(entry.status) ? entry.status : "idle",
          task: typeof entry.task === "string" ? entry.task : null,
          activity: typeof entry.activity === "string" ? entry.activity : "",
          since: typeof entry.since === "string" ? entry.since : base.updatedAt,
        };
      }
    }
    if (data.currentTask && typeof data.currentTask === "object") {
      base.currentTask = {
        slug: typeof data.currentTask.slug === "string" ? data.currentTask.slug : null,
        title: typeof data.currentTask.title === "string" ? data.currentTask.title : "",
        round: typeof data.currentTask.round === "number" ? data.currentTask.round : 1,
        phase: typeof data.currentTask.phase === "string" ? data.currentTask.phase : "",
      };
    }
    return base;
  } catch (error) {
    throw new Error(`状态文件损坏（${file}）：${error.message}`);
  }
}

function saveState(file, state) {
  mkdirSync(dirname(file), { recursive: true });
  state.updatedAt = new Date().toISOString();
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, file);
}

// ----- 子命令实现 -----
function cmdTask(args, state, file) {
  const slug = args._[1];
  if (!slug) throw new Error("用法：kanban task <slug> --title <标题> [--round N] [--phase <阶段>]");
  const title = args.title || "";
  state.currentTask = {
    slug,
    title,
    round: Number.isFinite(Number(args.round)) ? Number(args.round) : 1,
    phase: args.phase || "",
  };
  saveState(file, state);
  return `任务已登记：${slug}（${title || "无标题"}）round=${state.currentTask.round} phase=${state.currentTask.phase || "-"}`;
}

function cmdSet(args, state, file) {
  const role = args._[1];
  const status = args._[2];
  if (!ROLES.includes(role)) {
    throw new Error(`未知角色：${role}（可用：${ROLES.join(" / ")}）`);
  }
  if (!STATUSES.includes(status)) {
    throw new Error(`未知状态：${status}（可用：${STATUSES.join(" / ")}）`);
  }
  const entry = state.roles[role];
  entry.status = status;
  entry.task = args.task !== undefined ? args.task : entry.task;
  if (args.activity !== undefined) entry.activity = args.activity;
  if (status === "idle") {
    entry.task = null;
    entry.activity = "";
  }
  entry.since = new Date().toISOString();
  saveState(file, state);
  const task = entry.task ? ` @${entry.task}` : "";
  return `[看板] ${role} → ${status}${task}${entry.activity ? `：${entry.activity}` : ""}`;
}

function cmdClear(args, state, file) {
  const next = blankState();
  next.updatedAt = state.updatedAt;
  saveState(file, next);
  return "[看板] 已清空：全部角色 idle，currentTask=null";
}

function cmdShow(args, state, file) {
  if (args.json) {
    return JSON.stringify(state, null, 2);
  }
  const lines = [];
  const cur = state.currentTask;
  lines.push(
    `当前任务：${cur ? `${cur.slug}（${cur.title || "无标题"}）round=${cur.round} phase=${cur.phase || "-"}` : "（无）"}`,
  );
  lines.push(`更新于：${state.updatedAt}`);
  lines.push("");
  lines.push("角色               状态       任务      活动");
  lines.push("-".repeat(72));
  for (const role of ROLES) {
    const e = state.roles[role];
    const task = e.task ? `@${e.task}` : "-";
    const act = e.activity || "";
    lines.push(
      `${role.padEnd(18)}${e.status.padEnd(10)}${task.padEnd(22)}${act}`.slice(0, 130),
    );
  }
  return lines.join("\n");
}

function renderHtml(state) {
  const cur = state.currentTask;
  const colOf = (status) =>
    status === "done" ? "done" : status === "working" || status === "blocked" ? "working" : "idle";
  const cols = [
    { key: "working", title: "进行中 / 受阻" },
    { key: "done", title: "已完成" },
    { key: "idle", title: "待命" },
  ];
  const cards = ROLES.map((role) => {
    const e = state.roles[role];
    return { role, ...e, col: colOf(e.status) };
  });
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI 团队看板 — ${cur ? cur.title : "无任务"}</title>
<style>
  body { font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 24px; background: #f5f6f8; color: #1f2328; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #656d76; font-size: 13px; margin-bottom: 16px; }
  .board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: start; }
  .col { background: #fff; border: 1px solid #d8dee4; border-radius: 8px; padding: 10px; }
  .col h2 { font-size: 14px; margin: 2px 4px 10px; color: #57606a; }
  .card { border: 1px solid #d0d7de; border-left: 4px solid #0969da; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; background: #fff; }
  .card.working { border-left-color: #0969da; }
  .card.blocked { border-left-color: #cf222e; }
  .card.done { border-left-color: #1a7f37; opacity: .75; }
  .card h3 { font-size: 14px; margin: 0 0 4px; }
  .card .task { font-size: 12px; color: #0969da; margin-bottom: 4px; }
  .card .act { font-size: 12px; color: #57606a; }
  .card .since { font-size: 11px; color: #8c959f; margin-top: 6px; }
</style>
</head>
<body>
  <h1>AI 团队看板</h1>
  <div class="meta">当前任务：${cur ? `${cur.slug}（${cur.title || "无标题"}）· 第 ${cur.round} 轮 · ${cur.phase || "无阶段"}` : "（无）"} ｜ 更新于 ${state.updatedAt}</div>
  <div class="board">
${cols
  .map(
    (col) => `  <div class="col">
    <h2>${col.title}</h2>
${cards
  .filter((c) => c.col === col.key)
  .map(
    (c) => `    <div class="card ${c.status}">
      <h3>${c.role}</h3>
      ${c.task ? `      <div class="task">@${c.task}</div>` : ""}
      ${c.activity ? `      <div class="act">${c.activity}</div>` : ""}
      <div class="since">${c.since}</div>
    </div>`,
  )
  .join("\n")}
  </div>`,
  )
  .join("\n")}
</div>
</body>
</html>
`;
}

function cmdRender(args, state, file) {
  const out = args.out ? resolve(args.out) : join(dirname(file), "kanban.html");
  writeFileSync(out, renderHtml(state), "utf8");
  return `已生成 HTML 看板：${out}`;
}

// ----- main -----
function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(
      `用法：
  kanban task <slug> --title <标题> [--round N] [--phase <阶段>]
  kanban start <role> --task <slug> --activity <描述>
  kanban set <role> <status> [--task <slug>] [--activity <描述>]
  kanban done <role>
  kanban clear
  kanban show [--json]
  kanban render [--out <path>]
角色：${ROLES.join(" / ")}
状态：${STATUSES.join(" / ")}
仓库解析：--repo <path> > KANBAN_REPO > git rev-parse --show-toplevel`,
    );
    return 0;
  }
  try {
    const repo = resolveRepo(args);
    const file = stateFile(repo);
    const state = loadState(file);
    let out;
    switch (cmd) {
      case "task":
        out = cmdTask(args, state, file);
        break;
      case "start": {
        const role = args._[1];
        if (!role) throw new Error("kanban start 需要 <role>");
        if (!args.task) throw new Error("kanban start 需要 --task <slug>");
        out = cmdSet(
          { _: ["set", role, "working"], task: args.task, activity: args.activity },
          state,
          file,
        );
        break;
      }
      case "set":
        out = cmdSet(args, state, file);
        break;
      case "done": {
        const role = args._[1];
        if (!role) throw new Error("kanban done 需要 <role>");
        out = cmdSet({ _: ["set", role, "done"] }, state, file);
        break;
      }
      case "clear":
        out = cmdClear(args, state, file);
        break;
      case "show":
        out = cmdShow(args, state, file);
        break;
      case "render":
        out = cmdRender(args, state, file);
        break;
      default:
        throw new Error(`未知命令：${cmd}（可用：task / start / set / done / clear / show / render）`);
    }
    console.log(out);
    return 0;
  } catch (error) {
    console.error(`[kanban] ${error.message}`);
    return 1;
  }
}

// 直接执行（node bin/kanban.mjs ...）时才跑 CLI；被 lib/index.js 等 import 时只导出函数。
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  process.exit(main());
}

export { ROLES, STATUSES, loadState, renderHtml, resolveRepo, stateFile };
