
THE WORLD - 地图指令指南 v1.0
=====================================

本指南将指导你如何通过指令来构建、修改和感知这个世界，创造一个动态且持久的互动地图。

### 1. 核心概念

*   **节点 (Node)**: 地图上的一切都是一个“节点”，无论是大陆、城市还是一个小小的神龛。每个节点都有一个独一无二的、由小写字母和下划线组成的ID (例如 `stormwind_keep`)。
*   **世界书是数据库**: 你的所有地图创作都会被自动保存在一个专门的世界书里 `([TheWorld] MapNodes - 角色名)`。这是地图的永久记忆。
*   **ID 是关键**: 与节点交互时，请始终使用其唯一的 `id`，这能保证最高的准确性。你可以通过 `[TheWorld:Atlas]` 和 `[TheWorld:Locator]` 条目找到正确的ID。

### 2. AI 指令格式

你有两种方式来与地图系统交互，请根据场景选择最合适的一种。

#### A. 批量构建世界: `<MapUpdate>` 标签

*   **何时使用**: 第一次创建世界地图时、一次性添加多个地点时、或对世界进行大规模改造时。
*   **格式**: 在你的回复末尾，使用 `<MapUpdate>` 标签包裹一个JSON数组。每个JSON对象代表一个操作。
    *   `op`: 操作类型，`"add_or_update"` (添加或更新) 或 `"remove"` (删除)。
    *   `id`: 节点的唯一ID (必须)。
    *   其他所有 [MapNode 属性](https://github.com/SillyTavern/SillyTavern-extras/blob/main/extensions/the_world/types/map.d.ts) 都是可选的，例如 `illustration` (节点插图) 和 `mapImage` (区域背景图)。

*   **示例**: 创建艾尔文森林，并在其中放置闪金镇，并为它们添加插图。
    ```xml
    艾尔文森林是一片广袤的土地，其中坐落着著名的人类小镇——闪金镇。
    <MapUpdate>
    [
      {
        "op": "add_or_update",
        "id": "elwynn_forest",
        "name": "艾尔文森林",
        "type": "region",
        "coords": "500,500",
        "mapImage": "elwynn_map.jpg"
      },
      {
        "op": "add_or_update",
        "id": "goldshire",
        "parentId": "elwynn_forest",
        "name": "闪金镇",
        "type": "city",
        "coords": "520,550",
        "description": "一个繁忙的人类小镇，以其旅店而闻名。",
        "illustration": "goldshire_inn.png"
      }
    ]
    </MapUpdate>
    ```

#### B. 精准操作: `<command>` 标签

*   **何时使用**: 修改单个地点的状态、添加/移除NPC、移动玩家位置等日常操作。
*   **格式**: 在你的回复末尾，使用 `<command>` 标签包裹一个或多个 `[Map.函数(...)]` 指令。目标参数 (`target`) 可以是节点的 `id` 或 `name`。

*   **核心指令：移动玩家**:
    这是最重要的指令。当玩家移动到新地点时，你**必须**发送此指令来更新定位器。
    `[Map.SetProperty("player_location", "current_location_id", "要移动到的节点ID")]`
    *示例*: `你来到了闪金镇。<command>[Map.SetProperty("player_location", "current_location_id", "goldshire")]</command>`

*   **其他指令**:
    *   **设置属性**: `[Map.SetProperty(target, property, value)]`
        *示例*: `你清除了神龛周围的威胁。<command>[Map.SetProperty("shrine_of_unsung_heroes", "status", "cleared")]</command>`
    *   **添加NPC**: `[Map.AddNPC(target, {"id": "npc_id", "name": "NPC名称"})]`
        *示例*: `卫兵队长霍格出现在闪金镇。<command>[Map.AddNPC("goldshire", {"id": "npc_hogger", "name": "霍格"})]</command>`
    *   **移除NPC**: `[Map.RemoveNPC(target, "要移除的NPC的ID")]`
        *示例*: `霍格离开了闪金镇。<command>[Map.RemoveNPC("goldshire", "npc_hogger")]</command>`

### 3. AI 上下文参考 (你的眼睛)

系统会自动为你提供两个世界书条目来帮助你理解世界。

*   **`[TheWorld:Atlas]`**: 你的世界地图全貌。它用一个树状结构展示了所有已知地点的层级关系和ID。用它来获取全局信息。
*   **`[TheWorld:Locator]`**: 你的当前位置放大镜。它详细描述了你目前所在的节点、其周边环境、以及内部包含的子地点。这是你进行精细操作和获取上下文的主要参考。

### 4. 最佳实践

*   **指令置后**: 始终将 `<command>` 和 `<MapUpdate>` 标签放在你回复的最末尾。
*   **先建后动**: 使用 `<MapUpdate>` 创建世界，然后用 `<command>` 进行互动。
*   **移动必须报告**: 当玩家移动到新的节点时，**必须** 发出一个 `[Map.SetProperty("player_location", ...)]` 指令来更新你的位置，这至关重要！
