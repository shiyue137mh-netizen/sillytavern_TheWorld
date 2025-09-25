“The World” 插件 - 地图系统设计文档 v6.0 (统一画布架构)
=====================================================

本文档定义了“The World”插件中下一代地图功能的数据结构、AI交互格式以及核心工作机制。该系统采用统一的**节点（Node）**概念和**单一画布（Single Canvas）**的UI模式，旨在实现一个由**世界书驱动**的、可持久化、高度动态、交互直观且对AI输出友好的世界地图。

### 1. 核心设计原则

*   **统一画布 (Unified Canvas)**: 抛弃层级式、多页面的地图视图。所有地理实体（节点）都存在于一个无限的、可平移和缩放的单一画布上，提供最直观的探索体验。
*   **世界书为核心 (Lorebook-Driven)**: 地图数据完全存储于与角色卡绑定的世界书中，实现数据的持久化、可移植性，并为AI提供天然的上下文。
*   **优雅处理抽象节点**: 对于没有物理坐标的“孤立”节点（如梦境、数据空间），通过专门的侧边栏进行展示，使其既可访问又不过多干扰主地图的视觉呈现。
*   **情景感知 (Context-Aware)**: 通过一个强大的“定位器”条目，实时为AI提供其在世界中所处位置的详细上下文。
*   **合理的节点粒度 (Reasonable Node Granularity)**: 节点应代表具有一定地理范围或叙事重要性的独立区域。避免创建过于细微的节点，例如“酒馆里的一张桌子”或“森林里的一棵树”。通常，一个节点应该至少是一个独立的房间、一个地标建筑、或一片独特的区域。这能确保地图的宏观可读性，并将微观细节保留在文本描述中。

### 2. 世界书条目设计

系统通过两种核心条目类型协同工作，为AI提供一个分级的、按需加载的上下文环境。

#### 2.1 节点定义条目 (Node Definition)
这是地图数据的基本存储单元，每个节点一个条目。

*   **关键词**: `[MapNode:node_id]`，例如 `[MapNode:elwynn_forest]`
*   **附加关键词**: `node_id` 和 `name` (例如 `elwynn_forest` 和 `艾尔文森林`)。**重要提示**：如果一个节点拥有父节点，父节点的ID和名称会自动被添加为子节点的关键词，以增强AI的上下文联想能力。
*   **属性**: **关键词触发 (Selective)**
*   **内容 (JSON)**:
    ```json
    {
      "parentId": "azeroth_eastern_kingdoms",
      "name": "艾尔文森林",
      "type": "region",
      "coords": "450,800"
    }
    ```

#### 2.2 定位与上下文条目 (The Locator)
这是为AI提供核心上下文的入口，也是整个系统的“大脑”。

*   **关键词**: `[TheWorld:Locator]`
*   **属性**: **常驻 (Constant)**, 高优先级
*   **内容**: 一个由插件根据玩家当前位置**实时更新**的文本摘要，包含**面包屑路径、当前节点详情、同级节点和子节点列表**。
    ```
    [System Note: Your Current Location & Surroundings]
    Path: 艾泽拉斯 (azeroth) / 东部王国 (eastern_kingdoms) / 艾尔文森林 (elwynn_forest)

    == Current Location: 艾尔文森林 ==
    {
      "name": "艾尔文森林",
      "type": "region",
      "description": "一片广阔而宁静的森林..."
    }

    == Nearby (at same level in 东部王国) ==
    - 丹莫罗 (dun_morogh)
    - 洛丹伦 (lordaeron)

    == Places inside 艾尔文森林 ==
    - 闪金镇 (goldshire)
    - 无名英雄神龛 (shrine_of_unsung_heroes)
    ```

### 3. 数据结构

#### 3.1 节点对象 (MapNode Object)
这是地图上每个实体的统一数据结构。

*   **id (String, 必须)**: 节点的唯一程序化ID，稳定、不变、ASCII友好。例如: `shrine_of_unsung_heroes`。
*   **name (String, 必须)**: 节点的显示名称，可以是任何语言，可变。例如: `"无名英雄神龛"`。
*   **parentId (String, 可选)**: 父节点的`id`。没有此字段的节点为顶级节点。
*   **type (String, 可选)**: 节点类型，用于驱动UI渲染。如 `region`, `city`, `landmark`, `dungeon`。
*   **coords (String, 可选)**: 节点在统一画布上的**绝对坐标**。格式: `"x,y"` (0-1000)。
*   **description (String, 可选)**: 详细描述。
*   **status (String, 可选)**: 节点的动态状态。例如: `quest`, `danger`, `cleared`。
*   **illustration (String, 可选)**: 节点悬停卡片的图片文件名。
*   **npcs (Array, 可选)**: 存在于该地点的NPC对象数组 `[{id, name}]`。
*   **zoomThreshold (Number, 可选)**: 节点可见的最低缩放级别。值越小，代表节点越重要，越早（地图缩得越远时）出现。默认值会根据类型和层级自动设定。

### 4. UI与交互

地图面板被渲染为一个包含三个主要部分的容器：

1.  **画布 (Canvas)**: 一个可无限平移和缩放的区域。所有拥有`coords`的节点都将作为图钉渲染在此处。
    *   **视觉层级**: 没有`parentId`的顶级节点图钉尺寸较大，有`parentId`的子节点尺寸较小。
    *   **LOD (Level of Detail)**: 根据当前缩放级别和节点的 `zoomThreshold` 动态显示或隐藏节点，防止拥挤。当用户放大地图时，代表区域的父节点（如“艾尔文森林”）会在其内部的子节点（如“闪金镇”）出现时自动隐藏，为细节腾出空间，从而实现无缝的细节层次切换。
2.  **SVG图层**: 叠加在画布之上，用于动态效果。
    *   **交互式连线**: 当鼠标悬停在一个子节点上时，会在此图层上动态绘制一条虚线，连接该节点与其父节点，清晰地展示层级关系。
3.  **侧边栏 (Sidebar)**: 位于画布右上角。
    *   **孤立节点**: 所有**没有`coords`且没有`parentId`**的节点（例如“梦境”、“数据空间”等抽象地点）将被列在此处，使其可被访问但又不干扰主地图的地理布局。

### 5. AI交互格式与机制

#### 5.1 注册式：`<MapUpdate>` 标签
用于首次发现、批量更新或创建节点。AI只需提供一个**扁平化的节点对象数组**，插件会自动处理层级关系和世界书条目的创建/更新。

*   **op (String)**: `add_or_update` 或 `remove`。
    ```xml
    <MapUpdate>
    [
      {
        "op": "add_or_update",
        "id": "elwynn_forest",
        "name": "艾尔文森林",
        "type": "region",
        "coords": "500,500"
      },
      {
        "op": "add_or_update",
        "id": "shrine_of_unsung_heroes",
        "parentId": "elwynn_forest",
        "name": "无名英雄神龛",
        "type": "landmark",
        "coords": "440,865",
        "description": "一个古老的神龛..."
      }
    ]
    </MapUpdate>
    ```

#### 5.2 指令式：`<command>` 标签
用于对已存在节点进行微调。**所有指令的目标参数同时接受`id`或`name`**。

*   `Map.SetProperty(target, property, value)`: 修改单个属性。
    `<command>[Map.SetProperty("无名英雄神龛", "status", "cleared")]</command>`
*   `Map.AddNPC(target, npcObject)`: 添加NPC。
*   `Map.RemoveNPC(target, npcId)`: 移除NPC。
*   **设置玩家位置**: 通过一个特殊的 `SetProperty` 指令来触发定位器更新。
    `<command>[Map.SetProperty("player_location", "current_location_id", "shrine_of_unsung_heroes")]</command>