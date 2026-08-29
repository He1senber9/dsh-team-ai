# dsh-team-ai — AI 开发团队插件

把 AI 开发团队做成 DSH bundle 插件：7 个角色 skill + 团队编排引导 + workflow 模板。
装入 DSH profile 后，角色 skill 自动出现在 skill 目录中，按需加载。

## 包含内容

| 路径 | 说明 |
| --- | --- |
| `skills/team-pm/` | 产品经理：PRD + Given-When-Then 验收标准 |
| `skills/team-pjm/` | 项目经理：计划 / WBS / 并行策略 / 发布 |
| `skills/team-architect/` | 架构师：层归属 / 命令签名 / 安全影响分析 / 集成 |
| `skills/team-backend/` | 后端开发（Rust / Node）：core/ + src-tauri/ |
| `skills/team-frontend/` | 前端开发：app/ui/ React + TypeScript |
| `skills/team-qa/` | 高级测试：AC 100% / 负面安全测试 / P0–P3 否决 |
| `skills/team-reviewer/` | 代码审核：安全清单 / approve / request-changes |
| `skills/team-orchestrator/` | 团队编排：把 7 角色串成闭环流程 |
| `workflow/team-workflow.mjs` | DSH workflow 编排模板（一键跑完整流程） |
| `lib/index.js` | cordis 插件：注册 skills provider（复用官方 FileSystemSkillProvider） |
| `cordis.patch.yml` | bundle patch：insert `team-ai` 条目 |

## 安装

在 DSH profile（如 `~/.dsh/profiles/web`）安装本包：

```bash
dsh plugin --profile web add dsh-team-ai
```

或本地路径安装：

```bash
dsh plugin --profile web add /path/to/dsh-team-ai
```

安装后（必要时重启 DSH），`team-pm`、`team-qa` 等 8 个 skill 即可在会话中通过
`skill` 工具加载。插件把本包 `skills/` 注册为独立 provider（`includeDefaultRoots: false`），
不影响项目/用户的既有 skills。

## 使用

### 方式一：编排者引导（手动）

1. 加载 `team-orchestrator` skill，按流程分阶段调用各角色 skill：
   需求（`team-pm`）→ 规划（`team-pjm`）→ 设计（`team-architect`）→
   开发（`team-backend` ∥ `team-frontend`）→ 集成 → 质量（`team-qa`）→
   审核（`team-reviewer`）→ 发布。
2. 失败回环：QA/Review 不过时回到开发角色修复，缺陷记录在 `docs/tasks/<task>/bugs.md`。

### 方式二：workflow 一键编排

把 `workflow/team-workflow.mjs` 内容粘贴到 DSH workflow 工具的 `script` 参数，
`meta` 见文件头注释，`args` 传：

```json
{
  "workspace": "/path/to/your-repo",
  "task": {
    "slug": "password-generator",
    "title": "密码生成器",
    "desc": "在新建/编辑记录时提供随机强密码生成",
    "needsBackend": true,
    "needsFrontend": true
  },
  "maxRounds": 2
}
```

## 团队流程要点

- 产物集中在 `docs/tasks/<task>/`：prd / plan / design / test-report / review / bugs
- 通用门槛 G1–G7：cargo fmt/clippy/test、npm format:check/build、AC 100%、无 P0/P1
- 分支 `task-<slug>`（+ `-be` / `-fe`），worktree 建在仓库 `.worktrees/` 下
- 提交与 PR 一律中文（Conventional Commits）；合并到 master 必须走 PR

## 开发

```bash
node --check lib/index.js
```

## License

MIT
