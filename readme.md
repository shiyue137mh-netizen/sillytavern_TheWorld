
"The World" 插件 - 软件架构设计书 v2.0
=========================================

项目愿景: 打造一个前所未有的SillyTavern个性化框架。让“主题”不再局限于颜色和背景图片，而是成为一套与角色绑定的、可交互的、能完全重塑用户界面的“沉浸式体验包”。

### 1. 核心理念

*   **全局接管 (Global Takeover)**: 我们的目标不是添加悬浮窗口，而是直接修改和增强SillyTavern的原生UI组件，如聊天背景、消息气泡、输入框等。
*   **模块化特效 (Modular Effects)**: 动态功能（如天气、时间渐变、状态解析）将被封装成独立的、可复用的模块。

### 2. UI 修改策略 (双模式最终方案)

我们的最终实现采用了一套灵活的双模式系统，将视觉侵入性降至最低，同时为用户提供强大的自定义选项。

**模式一：动态背景模式 (默认)**

这是插件的默认工作模式，核心思想是**完全不干扰**SillyTavern的原生UI，只作为其“墙纸”。

*   **双层背景交叉淡入淡出**: 通过JavaScript在`<body>`中动态创建并维护两个`div`作为背景层，实现平滑的背景渐变动画。
*   **UI零侵入**: 在此模式下，我们**不修改**任何SillyTavern的颜色变量或透明度。酒馆UI保持其原生、不透明的外观，保证了最佳的可读性和兼容性。

**模式二：沉浸模式 (可选)**

当用户在设置中开启“沉浸模式”后，我们会在“动态背景模式”的基础上，额外注入一套增强样式。

*   **精确的毛玻璃效果**: 只针对核心聊天窗口`#chat`注入透明和模糊样式，使其变成一块能透出下方动态背景的“毛玻璃”。
*   **可控的半透明**: 只有消息气泡`.mes_content`的背景会被设置为半透明色。
*   **强制亮色文本**: 覆盖核心文本颜色变量，确保在任何背景下的可读性。

### 3. 核心工作流程

1.  **初始化**: `TheWorldApp.js` 作为总控制器，实例化所有核心模块 (`DataManager`, `UIController`, `MapSystem`, `AudioManager` 等)。
2.  **事件监听**: 插件监听 SillyTavern 的 `MESSAGE_RECEIVED`, `MESSAGE_EDITED`, `MESSAGE_SWIPED`, `MESSAGE_DELETED`, `CHAT_CHANGED` 等核心事件。
3.  **消息处理**: 当事件触发时，`TheWorldApp` 会对最新的AI消息进行处理。
4.  **解析**: `StateParser` 提取 `<WorldState>` 标签；`CommandParser` 提取 `<command>` 块中的所有 `[Module.Function(...)]` 指令。
5.  **状态更新**:
    *   `<WorldState>` 数据会更新 `TheWorldState` 对象，并通过 `DataManager` 持久化。
    *   `<MapUpdate>` 标签会触发 `MapSystem` 更新世界书中的地图数据。
6.  **指令执行**: `CommandProcessor` 接收解析后的指令，并分发给对应的模块执行（如 `AudioManager` 处理音频，`MapSystem` 处理地图修改）。
7.  **UI 渲染**: `UIController` 调用 `updateAllPanes()`，触发 `UIRenderer` 使用最新的 `TheWorldState` 和地图数据重新渲染UI。`PanelThemeManager` 和 `GlobalThemeManager` 应用相应的主题和特效。

### 4. 扩展文件结构

```
📁 the_world/
│
├── 📜 manifest.json              # 扩展声明文件
├── 📜 script.js                  # 扩展主入口
├── 📜 panel.html                 # UI面板的HTML结构
├── 📜 style.css                  # 主样式表，导入所有CSS
│
├── 📁 assets/                    # 存放所有静态资源 (音频、图片等)
│   └── 📁 audio/
│
├── 📁 config.js                  # 插件的全局配置文件
├── 📁 docs/                      # 存放给AI的开发与指令指南
│   ├── 📜 audio_guide.md        # - 音频指令指南
│   └── 📜 map_guide.md          # - 地图指令指南
│
├── 📁 modules/                   # 插件核心逻辑
│   ├── 📜 TheWorldApp.js         # - [大脑] 总控制器，负责初始化和事件流程
│   ├── 📜 IntroAnimation.js      # - 首次加载动画
│   ├── 📜 logger.js              # - 控制台日志工具
│   ├── 📜 state.js               # - 全局状态管理对象
│   │
│   ├── 📁 core/                  # - 核心引擎模块
│   │   ├── 📜 CommandParser.js      #   - 解析 <command> 标签
│   │   ├── 📜 CommandProcessor.js   #   - 执行已解析的指令
│   │   ├── 📜 DataManager.js        #   - 读写 localStorage
│   │   ├── 📜 InjectionEngine.js    #   - 动态注入CSS
│   │   ├── 📜 ThemeManager.js       #   - [面板] 主题与特效管理器
│   │   ├── 📜 GlobalThemeManager.js #   - [全局] 背景主题管理器
│   │   └── 📜 SkyThemeController.js #   - 管理天空颜色主题
│   │
│   ├── 📁 state_parser/          # - <WorldState> 标签解析器
│   ├── 📁 time_gradient/         # - 时间渐变颜色计算模块
│   ├── 📁 audio/                 # - 音频系统模块
│   ├── 📁 map_system/            # - 地图系统模块
│   └── 📁 weather_system/        # - 天气特效系统模块
│
├── 📁 themes/                    # 存放可配置的主题文件 (JSON)
│   ├── 📁 sky/                   # - 天空颜色主题
│   └── 📁 clouds/                # - 云朵颜色主题
│
└── 📁 ui/                        # UI界面相关模块
    ├── 📜 UIController.js       # - UI总控制器
    ├── 📜 UIRenderer.js         # - 负责渲染UI面板
    ├── 📜 UIEventManager.js     # - 负责绑定所有UI事件
    ├── 📜 UIPanelManager.js     # - 负责面板的拖动、缩放等物理交互
    ├── 📜 UIDialogs.js          # - 负责处理所有弹窗
    └── 📜 TimeAnimator.js       # - 负责时间数字的动画
```

### 5. 核心系统模块

#### 5.1 状态与数据系统 (State & Data System)
*   **`TheWorldState`**: 一个全局的、响应式的对象，用于存储所有临时的世界状态（如时间、天气、场景），是UI渲染的直接数据源。
*   **`DataManager`**: 负责将 `TheWorldState` 和用户设置持久化到浏览器的 `localStorage` 中。
*   **`StateParser`**: 从AI消息中解析 `<WorldState>` 标签，并将其内容更新到 `TheWorldState` 对象中。

#### 5.2 音频系统 (Audio System)
*   **AI完全主导**: 系统的每一个声音播放都必须由AI在当前消息中发出明确指令。环境音非持久化，若新消息中无指令则会自动淡出停止。
*   **双通道音景**: 分为可持续的**环境音 (Ambient)** 和一次性的**音效 (SFX)**。
*   **动态路径加载**: 指令直接使用音频文件名，无需静态清单，提供了极大的灵活性。

#### 5.3 地图系统 (Map System)
*   **统一画布**: 所有地理实体（节点）都存在于一个可平移和缩放的统一画布上，提供直观的探索体验。
*   **世界书为核心**: 地图数据完全存储于与角色卡绑定的世界书 `[TheWorld] MapNodes - [角色名]` 中，实现数据的持久化和可移植性。
*   **情景感知**: 通过 `[TheWorld:Atlas]` (全局概览) 和 `[TheWorld:Locator]` (当前位置详情) 两个世界书条目，为AI提供实时的、分级的上下文。

### 6. AI 交互 API

AI通过在消息中嵌入特定的标签和指令来与“The World”插件交互。

*   **`<WorldState>`**: 用于设置瞬时的、非持久的场景属性。插件会解析其中的键值对（如 `时间`, `天气`, `场景`）来更新UI和特效。
*   **`<MapUpdate>`**: 用于持久化的世界构建。通过一个JSON数组来批量创建、更新或删除地图节点，这些更改将被永久写入世界书。
*   **`<command>`**: 用于执行精确的、一次性的动作。采用 `[模块.函数(参数)]` 的格式，例如控制音频播放 `[FX.PlaySound(...)]` 或修改地图节点属性 `[Map.SetProperty(...)]`。

详细的指令用法请参考 `docs/` 目录下的 `audio_guide.md` 和 `map_guide.md`。

### 附录A：SillyTavern 核心UI元素CSS目标参考
(本部分保持不变，为主题创作者提供CSS变量和选择器清单)

**最重要的颜色变量:**
*   `--SmartThemeBodyColor`: **主要文本颜色**。
*   `--SmartThemeChatTintColor`: **聊天区域的背景色调**。
*   `--SmartThemeBlurTintColor`: **全局UI的背景和模糊底色**。
... (其余内容省略以保持简洁)
