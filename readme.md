SillyTavern 动态主题引擎 (Dynamic Theme Engine) - 软件架构设计书
THE world
版本：1.2

项目愿景: 打造一个前所未有的SillyTavern个性化框架。让“主题”不再局限于颜色和背景图片，而是成为一套与角色绑定的、可交互的、能完全重塑用户界面的“沉浸式体验包”。

1. 核心理念
全局接管 (Global Takeover): 我们的目标不是添加悬浮窗口，而是直接修改和增强SillyTavern的原生UI组件，如聊天背景、消息气泡、输入框等。

模块化特效 (Modular Effects): 动态功能（如天气、时间渐变、状态解析）将被封装成独立的、可复用的模块。主题创作者可以选择性地启用和配置这些模块。


2. UI 修改策略 (v4.0 - 双模式最终方案)
我们的最终实现采用了一套灵活的双模式系统，将视觉侵入性降至最低，同时为用户提供强大的自定义选项。

**模式一：动态背景模式 (默认)**

这是插件的默认工作模式，核心思想是**完全不干扰**SillyTavern的原生UI，只作为其“墙纸”。

- **双层背景交叉淡入淡出**:
  - 我们通过JavaScript在`<body>`中动态创建并维护两个`div`作为背景层 (`#the_world_bg_layer_1`, `#the_world_bg_layer_2`)。
  - 这两个层拥有极低的`z-index`，确保它们位于所有UI元素的最下方。
  - 当主题需要从A切换到B时，我们将新的背景图B应用到当前不可见的层，然后通过CSS `transition`平滑地改变这两个层的`opacity`（一个从1到0，另一个从0到1），从而实现无法通过`background-image`直接实现的**平滑渐变动画**。
- **UI零侵入**: 在此模式下，我们**不修改**任何SillyTavern的颜色变量、透明度或模糊度。酒馆UI保持其原生、不透明的外观，保证了最佳的可读性和兼容性。用户可以自由使用SillyTavern自带的任何主题，我们的动态背景会和谐地呈现在其后方。

**模式二：沉浸模式 (可选)**

当用户在设置中开启“沉浸模式”后，我们会在“动态背景模式”的基础上，额外注入一套增强样式。

- **精确的毛玻璃效果**:
  - 我们只针对核心聊天窗口`#chat`注入`background: transparent;`和`backdrop-filter: blur(...);`样式。这使得只有聊天区域变成一块能透出下方动态背景的“毛玻璃”。
  - 其他UI元素，如顶部菜单栏`#top-bar`和设置面板，**不受影响**，避免了之前版本中UI重叠导致文字难以阅读的问题。
- **可控的半透明**: 只有消息气泡`.mes_content`的`background-color`会被设置为一个由滑块控制的半透明色，实现了视觉层次感。
- **强制亮色文本**: 在此模式下，我们会覆盖`--SmartThemeBodyColor`等核心文本颜色变量，强制其使用高对比度的亮色，以确保在任何深色/渐变背景下的可读性。

**总结**: 这套双模式架构将选择权交给了用户。默认情况下，它是一个美观且无害的“动态壁纸”，而在需要时，又能化身为一个能提供深度沉浸体验的强大工具。

3. 扩展文件结构 (模仿 sillypoker 的模块化思想)
我们将在 SillyTavern/public/scripts/extensions/ 目录下创建 the_world 文件夹：

📁 the_world/
│
├── 📜 manifest.json              # 扩展声明文件
├── 📜 script.js                  # 扩展主入口，初始化所有核心模块
│
├── 📁 assets/                    # 存放所有静态资源
│   └── 📁 audio/                 # - 存放所有音频文件 (环境音/音效)
│
├── 📁 core/                      # 引擎核心，处理底层逻辑
│   ├── 📜 DataManager.js         # [记忆] 数据管理器：负责读写扩展设置
│   ├── 📜 InjectionEngine.js    # [双手] 注入引擎：负责向主页面动态添加/移除 CSS
│   ├── 📜 ThemeManager.js       # [面板主题] 负责面板和按钮的主题与特效
│   ├── 📜 GlobalThemeManager.js # [全局主题] 负责全局背景的主题与特效
│   ├── 📜 CommandParser.js      # [指令解析] 从AI消息中解析函数式指令
│   └── 📜 CommandProcessor.js   # [指令执行] 执行解析后的指令
│
├── 📁 docs/                      # 存放给AI的开发与指令指南
│   └── 📜 audio_guide.md        # - 音频指令指南
│
├── 📁 modules/                   # 可复用的功能模块
│   ├── 📁 audio/                 # 模块：音频管理器
│   │   └── 📜 index.js          # - 实现双通道、非持久化的音景系统
│   │
│   ├── 📁 time_gradient/         # 模块：时间渐变背景
│   │   └── 📜 index.js          # - 实现根据时间计算颜色渐变的逻辑
│   │
│   ├── 📁 weather_system/        # 模块：全局天气系统
│   │   ├── 📜 index.js          # - 天气主控制器，管理天气特效
│   │   └── 📁 effects/          # - 存放所有具体的天气特效实现
│   │
│   └── 📁 state_parser/          # 模块：AI消息解析器
│       └── 📜 index.js          # - 负责从AI消息中解析 <WorldState> 等自定义标签
│
├── 📁 themes/                    # 存放可配置的主题文件 (JSON)
│   ├── 📁 sky/                   # - 天色主题
│   └── 📁 clouds/                # - 云朵主题
│
└── 📁 ui/                        # 扩展自身的设置界面
    ├── 📜 UIController.js       # - 设置面板的总控制器
    ├── 📜 UIRenderer.js         # - 负责渲染各个UI面板
    ├── 📜 UIEventManager.js     # - 负责绑定所有UI事件
    └── 📜 UIPanelManager.js     # - 负责面板的拖动、缩放等物理交互

4. 数据结构定义
4.1. 主题包: theme.json
这是创作者定义一个主题的核心文件。modules.weather.default 的值现在可以直接对应effects文件夹下的具体特效名称。

{
  "id": "unique-theme-id-12345",
  "name": "赛博朋克雨夜 (Cyberpunk Rain)",
  "author": "创作者B",
  "version": "1.0",
  "description": "将酒馆变为霓虹灯闪烁的赛博朋克雨夜。会自动开启天气系统并解析世界状态。",
  "entrypoint": {
    "css": "style.css",
    "js": "script.js"
  },
  "modules": {
    "weather": {
      "enabled": true,
      "default": "rain" 
    },
    "timeGradient": {
      "enabled": true,
      "morningColor": "#3a3a5a",
      "noonColor": "#5a7a9a",
      "eveningColor": "#1a1a2a",
      "nightColor": "#0a0a1a"
    },
    "stateParser": {
        "enabled": true
    }
  },
  "assets": {
      "font": "fonts/pixel.woff2",
      "backgroundImage": "assets/city_view.png"
  }
}

4.2. 角色卡集成
在角色卡的 data 字段中，添加 dynamicThemeId 即可绑定。

{
  "name": "义体改造者K",
  "data": {
    "dynamicThemeId": "unique-theme-id-12345"
  }
}

5. 核心工作流程 (v4.0 - 最终版)
最终的工作流程清晰、可靠，并支持双模式切换。

1. **初始化 (`TheWorldApp.js`)**:
   - `TheWorldApp` 作为总控制器，实例化所有需要的模块，包括一个无状态的 `TimeGradient` 服务。
   - `UIRenderer`渲染出“动态背景”和“沉浸模式”两个开关。
   - `UIEventManager`为这两个开关绑定事件监听器。

2. **激活 ("动态背景"开关)**:
   - 当用户打开“动态背景”开关，`UIEventManager`调用`timeGradient.activate()`。
   - `timeGradient.activate()`会创建两个用于背景过渡的`div`层，并调用一次`updateTheme()`来应用初始背景。

3. **状态更新 (`TheWorldApp.js`)**:
   - 在接收到新消息、删除消息或切换聊天等任何可能改变世界状态的事件后，`TheWorldApp`会更新全局的`TheWorldState.latestWorldStateData`。
   - 更新完毕后，它会**立即显式调用`this.timeGradient.updateTheme()`**，确保主题与状态同步。

4. **主题渲染 (`TimeGradient.js`)**:
   - `updateTheme()`方法被调用时，它首先从`TheWorldState.latestWorldStateData`获取最新的“时段”和“天气”。
   - 根据这些信息，从预设的颜色方案中选择正确的渐变背景`bg`和文字颜色`text`。
   - **执行背景切换**: 通过交叉淡入淡出两个背景`div`层的`opacity`来平滑地切换到新的渐变背景。
   - **模式判断**: 检查`this.state.isImmersiveModeEnabled`的值。
     - **If `false` (背景模式)**: 生成一段极简的CSS，只包含两个背景层的基本样式和动画定义，然后注入页面。
     - **If `true` (沉浸模式)**: 在上述基础上，额外生成用于实现“毛玻璃”聊天窗口、半透明消息气泡和亮色文字的CSS规则，然后一并注入页面。

5. **停用**:
   - 当用户关闭“动态背景”开关，`timeGradient.deactivate()`被调用。
   - 它会移除注入的CSS样式块和两个背景`div`层，使页面完全恢复到SillyTavern的原生外观。

6. 面向创作者的API
为了方便主题开发者，script.js将可以访问一个全局对象，例如DTE (Dynamic Theme Engine)，提供一些便捷的工具函数和事件接口：

// 示例：在主题的 script.js 中使用
if (DTE) {
    // 监听世界状态更新
    DTE.on('worldStateUpdate', (newState) => {
        console.log('天气变了!', newState.weather);
        // 在这里编写根据天气改变某个自定义HTML元素内容的逻辑
    });

    // 获取当前SillyTavern的核心DOM元素
    const chatWindow = DTE.getTarget('chat');
    const sendButton = DTE.getTarget('sendButton');

    // 添加一个自定义按钮到顶部菜单
    DTE.ui.addMenuButton('我的按钮', () => { alert('按钮被点击！'); });
}

附录A：SillyTavern 核心UI元素CSS目标参考
本附录为主题创作者提供一份常用UI元素的CSS变量和选择器清单。请优先使用CSS变量进行修改，以获得最佳的动态效果和兼容性。

A.1. 核心CSS变量 (v3.0 已验证)
经过对SillyTavern源码的分析，我们确认其主题由一套名为`--SmartTheme...`的核心变量驱动。我们的目标就是通过动态生成CSS来覆盖这些变量。

**最重要的颜色变量:**

- `--SmartThemeBodyColor`: **主要文本颜色**。这是保证可读性的第一要素。
- `--SmartThemeEmColor`: **强调文本/图标颜色**。影响斜体字和大多数UI图标的颜色。
- `--SmartThemeQuoteColor`: **引用/链接颜色**。
- `--SmartThemeChatTintColor`: **聊天区域的背景色调**。改变聊天背景的关键。
- `--SmartThemeBlurTintColor`: **全局UI的背景和模糊底色**。应与`--SmartThemeChatTintColor`保持协调，以确保视觉统一。
- `--SmartThemeBorderColor`: **边框颜色**。影响面板、按钮等元素的边框。

A.2. 主要布局与容器ID
body: 整个页面的根容器，适合应用全局背景。

#chat_background: 聊天区域的专用背景层。

#top-bar: 顶部菜单栏。

#left-nav-panel: 左侧导航面板（角色列表）。

#right-nav-panel: 右侧功能面板。

#form_outer: 整个底部输入区域的容器。

A.3. 聊天区域Class与ID
#chat: 包含所有消息的滚动容器。

.message: 代表单条消息的通用class。

.user: 用户的消息。

.bot: AI角色的消息。

.mes_content: 消息气泡内实际的文本内容。

.avatar > img: 角色头像图片。

A.4. 输入区域ID
#send_form: 包含输入框和所有按钮的表单。

#prompt-input: 用户输入文字的文本框。

#send_button: 发送按钮。

#send_but_icon: 发送按钮上的图标。

#stop_button: 停止生成按钮。

A.5. 通用控件Class
.menu_button: 顶部和侧边栏菜单按钮的通用class。

.swiper-button: 切换角色表情等滑块按钮的class。

.option-item: 设置面板中的选项条目。

.text_button: 各种文本样式的按钮。

注意: 这份列表并非详尽无遗，但涵盖了90%以上的主题定制需求。强烈建议在开发时使用浏览器的开发者工具（F12）来检查和定位更具体的元素。


指南：如何修改酒馆UI及聊天背景
本文档将详细解释SillyTavern的背景渲染机制，并提供一个具体、可行的示例，指导主题创作者如何通过“动态主题引擎”来修改聊天背景，并确保界面的可读性和美观性。

1. 理解酒馆的背景机制
SillyTavern的界面是由多个“图层”叠加而成的。理解这些图层是进行修改的关键。

最底层 (body): 这是整个网页的根。

背景层 (#chat_background): 这是一个专门用来显示背景图片或颜色的div。它位于body之上，但在所有聊天内容之下。这就是我们的主要目标。

内容层 (#chat): 这个div包含了所有的消息气泡（.message）。它的背景通常是透明的，所以我们可以透过它看到下面的#chat_background。

UI元素层: 消息气泡、文字、按钮等，它们都在最顶层。

为什么这很重要？
因为SillyTavern已经为我们分好层了。我们不需要担心修改背景会直接影响文字，因为它们在不同的“图层”上。我们只需要修改#chat_background的样式，就可以安全地更换聊天背景，而不会影响到上层的消息气泡。

酒馆原生的“背景图选择”功能，其本质就是修改#chat_background这个元素的CSS background-image属性。

2. 我们的修改策略与示例
我们的策略是精准打击，只修改我们需要修改的部分。

示例：创建一个“深夜书房”动态主题

假设我们想把聊天背景换成一张昏暗的书房图片，同时让文字颜色变成柔和的米白色以保证可读性。

第一步：准备主题包 theme.json
这是我们的主题包核心。创作者需要提供CSS代码来实现这个效果。

{
  "id": "theme-study-night-56789",
  "name": "深夜书房",
  "author": "您",
  "version": "1.0",
  "description": "一个安静的深夜书房主题，带有柔和的文字颜色。",
  "content": {
    "css": "/* CSS内容见下方 */",
    "html": null,
    "js": null
  }
}

第二步：编写CSS代码 (核心)
这是content.css字段内的具体内容。

/*
 * ==================================================================
 * 步骤 1: 修改聊天背景
 * 我们直接选中 #chat_background 元素，并为它设置背景图片。
 * 使用 !important 可以确保我们的样式优先级最高，覆盖掉酒馆的默认设置。
 * ==================================================================
 */
#chat_background {
    background-image: url('[https://w.wallhaven.cc/full/j8/wallhaven-j8g7p5.jpg](https://w.wallhaven.cc/full/j8/wallhaven-j8g7p5.jpg)') !important; /* 一张网络图片URL作为示例 */
    background-size: cover !important;
    background-position: center center !important;
    background-repeat: no-repeat !important;
}

/*
 * ==================================================================
 * 步骤 2: UI颜色适配 (手动)
 * 为了保证在新的深色背景下文字清晰可读，我们必须修改
 * SillyTavern的CSS颜色变量。
 * 我们把主要的文字颜色改为柔和的米白色。
 * ==================================================================
 */
:root {
    --main-text-color: #EAE0C8 !important; /* 主要文字颜色 */
    --quote-text-color: #BDB5A2 !important; /* 引用文字颜色 */
}

/*
 * ==================================================================
 * 步骤 3: (可选) 适配消息气泡
 * 我们可以让消息气泡变成半透明的深色，这样既能看清文字，
 * 又能隐约透出后面的背景，增加沉浸感。
 * ==================================================================
 */
.mes_content {
    background-color: rgba(20, 20, 20, 0.6) !important; /* 半透明深灰色背景 */
    backdrop-filter: blur(2px); /* (高级效果) 添加一点模糊，更有质感 */
    border: 1px solid rgba(255, 255, 255, 0.1); /* 添加一个微弱的边框 */
}

3. 工作流程总结
当用户加载这个“深夜书房”主题时，我们的注入引擎 (injectionEngine.js) 会读取content.css字段。

引擎会创建一个新的<style>标签，并将上面所有的CSS代码作为内容写入。

这个<style>标签被添加到酒馆页面的<head>中。

浏览器立即解析这些新的CSS规则：

#chat_background的背景被替换成了我们的书房图片。

SillyTavern的所有文字颜色因为--main-text-color变量的改变，自动从默认的颜色变成了我们设定的#EAE0C8米白色。

所有消息气泡.mes_content都应用了我们设计的半透明样式。

通过这种方式，我们不仅成功修改了聊天背景，还通过修改CSS变量和针对性地覆盖样式，完美地解决了UI适配和文字可读性的问题。这就是我们扩展的核心工作原理。