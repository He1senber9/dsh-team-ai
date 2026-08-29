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
| `bin/kanban.mjs` | 团队看板 CLI：维护 `docs/team/kanban.json`（角色↔状态↔任务↔活动），可生成 HTML 看板 |
| `lib/index.js` | cordis 插件：注册 skills provider（复用官方 FileSystemSkillProvider） |
| `cordis.patch.yml` | bundle patch：insert `team-ai` 条目 |

## 安装

在 DSH profile（如 `~/.dsh/profiles/web`）安装本包：

```bash
# 从 GitHub 安装（推荐）
dsh plugin --profile web add github:He1senber9/dsh-team-ai#main

# 本地源码目录安装（仅开发调试用）
dsh plugin --profile web add /path/to/dsh-team-ai
```

> 本插件为公共插件，与任何具体项目解耦：不含项目路径、仓库名或私有凭据。

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
`meta` 见文件头注释，`args` 传（以下仅为示例值，插件与具体项目解耦，不内置任何项目路径/仓库名）：

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

参数说明：

- `workspace` / `repo`（必填）：目标仓库绝对路径，缺失时 workflow 直接报错
- `projectName`（可选）：角色自称与文档抬头使用的项目名，缺省取 `workspace` 目录名
- `ghRepo`（可选）：GitHub `owner/repo`，发布阶段建 PR 用；缺省由发布工程师从
  `git remote get-url origin` 推导（支持 https 与 `git@` 形式）
- `base`（可选）：目标合并分支，缺省 `master`

## 团队看板

团队流程执行期间，各角色通过 `bin/kanban.mjs` 把状态写入目标仓库的
`docs/team/kanban.json`（**实时状态文件，不提交入库**），标识"谁正在处理什么任务"。

### 两种查看方式

1. **DSH Web GUI 面板**（推荐）：插件自带浏览器端客户端插件，DSH 重启后
   侧边栏底部出现「📋 团队看板」入口，点击展开浮动看板（角色分列：
   进行中/受阻、已完成、待命），每 5 秒自动刷新，可一键打开完整 HTML 看板。
2. **CLI / HTML**：

```bash
# 定位 CLI（插件装在 profile 的 node_modules 里）
KANBAN_CLI=$(find -L "$HOME/.dsh" -maxdepth 6 -name kanban.mjs -path '*dsh-team-ai*' 2>/dev/null | head -n1)

# 登记任务/阶段、开工、完成、复位
node "$KANBAN_CLI" task <slug> --title "<标题>" --round N --phase <阶段> --repo <仓库>
node "$KANBAN_CLI" start team-backend --task <slug> --activity "<正在做什么>" --repo <仓库>
node "$KANBAN_CLI" done team-backend --repo <仓库>
node "$KANBAN_CLI" clear --repo <仓库>

# 查看 / 生成 HTML 看板（浏览器打开）
node "$KANBAN_CLI" show --repo <仓库>
node "$KANBAN_CLI" render --out kanban.html --repo <仓库>
```

### 看板数据配置

GUI 面板与 `/team-ai/kanban.json` 路由需要知道状态文件在哪个仓库，二选一：

- **插件配置 `kanbanRepo`**（推荐，profile 级 patch）：

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: team-ai
  name: dsh-team-ai
  config:
    kanbanRepo: /path/to/your-repo
```

- **环境变量 `KANBAN_REPO`**（DSH 进程启动时注入）

未配置时面板显示提示，不影响 skills 与 workflow 功能。

### 其他约定

- 仓库解析：`--repo <path>` > `KANBAN_REPO` 环境变量 > 当前目录 git 根
- **worktree 中执行必须加 `--repo <主仓库根>`**（默认解析会指向 worktree 自身）
- 角色 `team-pm / team-pjm / team-architect / team-backend / team-frontend / team-qa /
  team-reviewer / team-orchestrator / team-general`；状态 `idle / working / done / blocked`
- 角色 skill 的「工作方式」与 workflow 各阶段已内置看板登记指令（自动执行）

## 团队流程要点

- 产物集中在 `docs/tasks/<task>/`：prd / plan / design / test-report / review / bugs
- 通用门槛 G1–G7：cargo fmt/clippy/test、npm format:check/build、AC 100%、无 P0/P1
- 分支 `task-<slug>`（+ `-be` / `-fe`），worktree 建在仓库 `.worktrees/` 下
- 提交与 PR 一律中文（Conventional Commits）；合并到 master 必须走 PR

## 开发

```bash
npm run check         # 语法检查（lib/index.js、bin/kanban.mjs）+ client 源码构建检查
npm run build:client  # 构建 lib/client.js（src/client.tsx → Web 客户端插件注册脚本）
npm run watch:client  # watch 模式：修改 src/client.tsx 自动重建，GUI 经 HMR 热换（无需重启 DSH）
```

> 首次新增/修改 `dsh.client` 声明或 bundle 文件时需**重启 DSH**；此后只改
> `src/client.tsx` 用 watch 构建即可热更。

## License

MIT
