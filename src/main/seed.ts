import type { Flow, PromptInput, StageId, TrackId } from '@shared/types'
import { STAGE_COLORS } from '@shared/types'
import type { PromptRepository } from './store/repository'

/**
 * Built-in route: the steps of a project in order, one prompt per step (five
 * variants where the project type changes what to do). This is the product —
 * the route is empty without it. Seeded once, when no step (category with a
 * stage) exists yet, so an upgrade from the pre-stage data format gets the
 * built-ins alongside whatever it already had. Users edit these like any other
 * prompt.
 *
 * Prompt rules: at most one {{variable}} and it is one sentence; every step
 * reads the file the previous step wrote and writes the next, so the user
 * never carries text between steps.
 */
export function seedIfEmpty(repo: PromptRepository): void {
  if (repo.listCategories().some((c) => c.stage)) return

  for (const step of STEPS) {
    const cat = repo.createCategory({
      name: step.name,
      color: STAGE_COLORS[step.stage],
      stage: step.stage,
      hint: step.hint,
      output: step.output,
      flow: step.flow
    })
    const variants: [TrackId | null, string][] = step.byTrack
      ? (Object.entries(step.byTrack) as [TrackId, string][])
      : [[null, step.prompt!]]
    for (const [track, content] of variants) {
      const input: PromptInput = {
        title: step.name,
        description: step.hint,
        categoryId: cat.id,
        track,
        content,
        variables: step.question
          ? [{ name: '一句话', label: step.question, type: 'multiline', required: true }]
          : []
      }
      repo.createPrompt(input)
    }
  }
}

interface SeedStep {
  stage: StageId
  name: string
  hint: string
  output: string
  flow?: Flow
  /** label of the single {{一句话}} input, when the step takes one */
  question?: string
  prompt?: string
  byTrack?: Record<TrackId, string>
}

const STEPS: SeedStep[] = [
  // ---- 想清楚 ----
  {
    stage: 'think',
    flow: 'fresh',
    name: '说清想法',
    question: '你想做什么？',
    hint: '你脑子里有个点子，或者一句话需求。不用写详细，AI 会反问你。',
    output: 'docs/01-想法.md',
    prompt: `我想做：{{一句话}}

先别给方案。请先问我 3-5 个最关键的问题（给谁用、解决什么、成功是什么样），等我回答。
我回答完后，把整理好的结论写到 docs/01-想法.md（没有 docs 文件夹就先建一个），包含：一句话定位、目标用户、要解决的问题、不做什么。`
  },
  {
    stage: 'think',
    flow: 'fresh',
    name: '划 MVP 范围',
    hint: '想法有了，现在决定第一版只做什么。砍得越狠越好。',
    output: 'docs/02-范围.md',
    prompt: `读 docs/01-想法.md。

把第一版要做的功能列出来，每条打标：必须有 / 有更好 / 以后再说。
「必须有」控制在 3-5 条，能用手动流程替代的都砍掉。
写到 docs/02-范围.md。最后用一句话告诉我第一版做完后用户能干什么。`
  },
  {
    stage: 'think',
    flow: 'fresh',
    name: '写需求文档',
    hint: '把前两步变成一份别人也能看懂的文档，后面每一步都会读它。',
    output: 'docs/03-需求.md',
    prompt: `读 docs/01-想法.md 和 docs/02-范围.md。

写一份精简需求文档到 docs/03-需求.md：背景与目标、用户故事（作为…我想…以便…）、每个功能的验收标准、明确不做的事。
1000 字以内。写完列出你不确定、需要我拍板的点。`
  },

  // ---- 定方案 ----
  {
    stage: 'plan',
    flow: 'fresh',
    name: '选技术栈',
    question: '你会什么？完全不会也可以写「不会」',
    hint: '不用你懂技术。AI 按项目类型和你的情况推荐一套，说清为什么。',
    output: 'docs/04-技术栈.md',
    byTrack: {
      web: `读 docs/03-需求.md。我的情况：{{一句话}}

为这个网站推荐一套技术栈：前端框架、后端、数据库、认证、部署平台。每项一句话理由，优先成熟、文档全、社区大的。给一个备选。
写到 docs/04-技术栈.md。`,
      cli: `读 docs/03-需求.md。我的情况：{{一句话}}

为这个命令行工具推荐：语言与运行时、参数解析库、配置文件方式、打包/分发方式（npm、单文件二进制或包管理器）。每项一句话理由。
写到 docs/04-技术栈.md。`,
      desk: `读 docs/03-需求.md。我的情况：{{一句话}}

为这个桌面应用推荐：壳（Electron / Tauri / 原生）、界面框架、本地存储、打包与签名、自动更新方案。说明各壳的体积与门槛差异。
写到 docs/04-技术栈.md。`,
      mobile: `读 docs/03-需求.md。我的情况：{{一句话}}

为这个手机 App 推荐：跨平台还是原生（React Native / Flutter / Swift+Kotlin）、导航、状态管理、后端与推送、上架所需账号。说明各方案的门槛。
写到 docs/04-技术栈.md。`,
      other: `读 docs/03-需求.md。我的情况：{{一句话}}

推荐一套最省事的技术方案：语言、核心依赖、运行与分发方式。每项一句话理由，优先我已经会的。
写到 docs/04-技术栈.md。`
    }
  },
  {
    stage: 'plan',
    flow: 'fresh',
    name: '定架构与数据',
    hint: '模块怎么分、数据长什么样、模块之间怎么传。这一步定了，后面不返工。',
    output: 'docs/05-架构.md',
    prompt: `读 docs/03-需求.md 和 docs/04-技术栈.md。

给出：模块划分（每个一句话职责）、数据模型（实体、字段、关系）、模块间的数据流（mermaid 图）、目录结构。
原则：能一个进程解决不拆服务，能用框架自带的不自己造。
写到 docs/05-架构.md。`
  },

  // ---- 搭骨架 ----
  {
    stage: 'scaffold',
    flow: 'fresh',
    name: '初始化项目',
    hint: '创建空项目、装工具链、跑通 Hello World。AI 直接动手，你看着就行。',
    output: '跑起来的空项目',
    byTrack: {
      web: `读 docs/04-技术栈.md 和 docs/05-架构.md。

按技术栈初始化项目：创建工程、安装依赖、配 TypeScript / Lint / 测试、写 dev/build/test 脚本、.gitignore、.env.example、README 骨架。
最后做一个能打开的首页，并告诉我怎么在浏览器里看到它。`,
      cli: `读 docs/04-技术栈.md 和 docs/05-架构.md。

初始化命令行项目：工程、依赖、Lint、测试、bin 入口、一个 --help 能跑的最小命令。
告诉我怎么在本机执行它。`,
      desk: `读 docs/04-技术栈.md 和 docs/05-架构.md。

初始化桌面项目：壳 + 界面框架的工程、主进程 / 渲染进程分层、Lint、测试、一个能打开的空窗口。
告诉我怎么启动。`,
      mobile: `读 docs/04-技术栈.md 和 docs/05-架构.md。

初始化手机项目：工程、导航骨架、Lint、测试、一个能在模拟器里打开的首屏。
告诉我怎么在模拟器里看到它。`,
      other: `读 docs/04-技术栈.md 和 docs/05-架构.md。

初始化项目：工程、依赖、Lint、测试脚本、一个能运行的最小入口。
告诉我怎么运行它。`
    }
  },
  {
    stage: 'scaffold',
    flow: 'fresh',
    name: '基础设施',
    hint: '每种项目都有必须先铺好的底子。铺完才开始做功能。',
    output: '基础能力就绪',
    byTrack: {
      web: `读 docs/05-架构.md。

搭好网站的底子：数据库连接与迁移、注册/登录/会话（用成熟库，不自己写加密）、环境变量集中读取并校验、统一错误处理。
每项做完给我一个验证方法。`,
      cli: `读 docs/05-架构.md。

搭好命令行工具的底子：参数与子命令结构、配置文件读取（含默认值和校验）、彩色输出与 --json 输出、错误码约定。
每项做完给我一个验证方法。`,
      desk: `读 docs/05-架构.md。

搭好桌面应用的底子：窗口与托盘、主/渲染进程安全通信、本地数据存储（原子写入 + 备份）、设置持久化。
每项做完给我一个验证方法。`,
      mobile: `读 docs/05-架构.md。

搭好手机 App 的底子：导航结构、权限申请流程、本地存储与离线、网络层与错误提示、推送占位。
每项做完给我一个验证方法。`,
      other: `读 docs/05-架构.md。

搭好底子：配置读取、日志、错误处理、测试脚手架。
每项做完给我一个验证方法。`
    }
  },

  // ---- 做功能（循环） ----
  {
    stage: 'build',
    flow: 'existing',
    name: '读懂现有代码',
    hint: '接手的是别人的代码。先让 AI 带你看一遍，再动手。',
    output: 'docs/00-现状.md',
    prompt: `看一遍当前仓库（README、package/依赖文件、入口、目录结构）。

用 5 句话告诉我：这是什么、给谁用、怎么跑起来。然后列出主要模块和依赖关系、先读哪几个文件、看到的风险和技术债。
写到 docs/00-现状.md。`
  },
  {
    stage: 'build',
    name: '描述功能 → 拆任务',
    question: '这次做哪个功能？',
    hint: '一次只做一个功能。用一句话说，AI 拆成可勾选的小任务。',
    output: 'docs/tasks/<功能>.md',
    prompt: `读 docs/03-需求.md（有的话）和 docs/05-架构.md 或 docs/00-现状.md。这次要做的功能：{{一句话}}

先写这个功能的验收标准，再拆成 3-8 个小任务，每个任务能独立验证、30 分钟内做完，用 - [ ] 复选框列出。
写到 docs/tasks/<功能名>.md。先不要写代码，等我确认任务列表。`
  },
  {
    stage: 'build',
    name: '实现',
    hint: '按任务清单一个一个做，做完一个打一个勾。',
    output: '代码 + 勾选的任务',
    prompt: `读 docs/tasks/ 里当前功能的任务文件。

按顺序做第一个未勾选的任务：先读相关文件，改动最小，遵循现有风格。做完把它勾上，告诉我改了哪些文件、怎么验证。然后停下等我说「继续」。`
  },
  {
    stage: 'build',
    name: '测试',
    hint: '功能做完了，让 AI 补上测试，以后改坏了能立刻知道。',
    output: '测试通过',
    prompt: `读 docs/tasks/ 里当前功能的任务文件和相关代码。

为这个功能写测试：正常路径、边界、出错情况。测试名要能读出「什么情况下期望什么」。跑一遍，把结果贴给我。哪些行为不值得测，说明理由。`
  },
  {
    stage: 'build',
    name: '审一遍',
    hint: '代码质量 + 安全一起看。只报真问题，修完这个功能就算完成。',
    output: '问题清单 + 修复',
    prompt: `审查当前功能的所有改动（git diff）。

按严重程度列问题：会出错/丢数据的、边界没处理的、安全的（注入、越权、敏感信息泄露）、可读性的。每条：位置 / 问题 / 改法。
只报真实问题。列完直接修严重和安全两类，其余问我。`
  },

  // ---- 上线 ----
  {
    stage: 'ship',
    name: '发布',
    hint: '让别人用上。按项目类型走对应的发布方式。',
    output: '线上 / 可安装的版本',
    byTrack: {
      web: `读 docs/04-技术栈.md。

把网站部署上线：配置部署平台、生产环境变量、数据库、域名与 HTTPS、CI 自动部署。给我一个逐步清单，我做一步你确认一步。上线后告诉我怎么回滚。`,
      cli: `读 docs/04-技术栈.md。

发布命令行工具：版本号、变更日志、发布到 npm（或构建各平台二进制并附到 GitHub Release）、安装说明写进 README。给我逐步清单。`,
      desk: `读 docs/04-技术栈.md。

发布桌面应用：三平台打包、代码签名与公证（说明没签名会怎样）、自动更新通道、GitHub Release。给我逐步清单，CI 里怎么跑。`,
      mobile: `读 docs/04-技术栈.md。

发布手机 App：开发者账号、图标与截图、隐私说明、TestFlight / 内测轨道、正式上架审核要点。给我逐步清单和常见被拒原因。`,
      other: `读 docs/04-技术栈.md。

发布这个项目：版本号、变更日志、打包或发布到对应的包管理器、安装与使用说明。给我逐步清单。`
    }
  }
]
