# THE WORLD - 开发者 API 指南 v1.0

本指南为地图和世界书的创作者提供了一套强大的宏和斜杠指令，以编程方式读取和操控 "The World" 插件的状态。

## 1. 宏 (Macros) - 读取世界

这些宏遵循酒馆的标准 `{{...}}` 语法，允许你在角色卡、世界书条目或聊天消息中动态地**读取**插件的当前状态。

### `{{tw_state::(key)}}`
获取当前世界状态 (WorldState) 中的一个值。
- **key**: `时间`, `天气`, `地点`, `场景`, `时段`, `季节` 等。
- **示例**: `当前天气是：{{tw_state::天气}}`

### `{{tw_player_location::(property)}}`
获取玩家当前所在地图节点的属性。
- **property**: `id`, `name`, `type`, `description`, `status`。
- **示例**: `你目前位于 {{tw_player_location::name}}。`

### `{{tw_node_prop::(node_id_or_name)::(property)}}`
获取地图上任意节点的指定属性。
- **node_id_or_name**: 节点的ID或名称。
- **property**: `id`, `name`, `type`, `description`, `status`, `illustration`, `parentId`, `coords`。
- **示例**: `远方的暴风城状态是 {{tw_node_prop::stormwind_keep::status}}。`

### `{{tw_list_children::(node_id_or_name)}}`
以逗号分隔的列表，返回指定节点下的所有子地点名称。
- **示例**: `{{player_location::name}} 内的地点有：{{tw_list_children::{{player_location::id}}}}`

### `{{tw_list_npcs::(node_id_or_name)}}`
以逗号分隔的列表，返回指定节点下的所有NPC名称。
- **示例**: `这里有以下人物：{{tw_list_npcs::goldshire}}`

### `{{tw_node_exists::(node_id_or_name)}}`
检查具有指定ID或名称的节点是否存在于地图数据中。返回 `true` 或 `false`。这对于防止重复注册地点至关重要。
- **node_id_or_name**: 节点的ID或名称。
- **示例 (在AI指令或世界书中使用)**:
  ```
  if {{tw_node_exists::闪金镇}} == false, then:
  <|
    看起来“闪金镇”尚未被记录。正在为你创建...
    <MapUpdate>[{"op":"add_or_update", "id":"goldshire", "name":"闪金镇"}]</MapUpdate>
  |>
  else:
  <|
    你来到了已知的地点：闪金镇。
    <command>[Map.SetProperty("player_location", "current_location_id", "goldshire")]</command>
  |>
  ```

### `{{tw_weekday}}`
返回当前 `WorldState` 中日期对应的星期 (例如, "星期一")。它会自动进行计算，你无需在 `<WorldState>` 中提供星期信息。
- **示例**: `今天是{{tw_weekday}}。`

### `{{tw_holiday}}`
返回当前 `WorldState` 中日期对应的节日名称 (例如, "圣诞节")。如果当天不是节日，则返回一个**空字符串**。
- **示例**: `今天是{{tw_holiday}}，街上真热闹！`

## 2. 斜杠指令 (Slash Commands) - 操控世界

这些指令允许你通过聊天输入、快速回复或脚本，主动地**修改**世界状态、地图数据和触发特效。

### `/tw_set_state key="..." value="..."`
强制设置一个世界状态的值。
- **key** (必需): 状态的键名 (例如: `天气`, `时段`)。
- **value** (必需): 新的值。
- **示例**: `/tw_set_state key=天气 value=暴雨`

### `/tw_player_move target="..."`
将玩家移动到一个新的地图节点。
- **target** (必需): 目标节点的ID或名称。
- **示例**: `/tw_player_move target=goldshire`

### `/tw_node_create id="..." name="..." [options...]`
创建或更新一个地图节点。如果ID已存在，则更新现有节点。
- **id** (必需): 节点的唯一ID。
- **name** (创建时必需): 节点的显示名称。
- **parentId, type, coords, description, illustration, status** (可选): 节点的其他属性。
- **示例**: `/tw_node_create id=test_dungeon name=测试地城 parentId=elwynn_forest coords="550,550"`

### `/tw_node_delete target="..."`
从地图上永久删除一个节点。
- **target** (必需): 要删除的节点的ID或名称。
- **示例**: `/tw_node_delete target=test_dungeon`

### `/tw_play_sound path="..." [options...]`
播放一个一次性的音效。
- **path** (必需): 音效的文件名 (例如: `door_creak.mp3`)。
- **volume, pan, delay** (可选): 音量 (0-1)、声道 (-1 to 1)、延迟 (秒)。
- **示例**: `/tw_play_sound path=door_creak.mp3 volume=0.7`

### `/tw_play_ambient path="..." [options...]`
播放或切换一个循环的环境音。
- **path** (必需): 环境音的文件名。
- **volume, fade** (可选): 音量 (0-1)、淡入/淡出时长 (秒)。
- **示例**: `/tw_play_ambient path=forest_night.mp3 fade=5`

### `/tw_stop_ambient [options...]`
停止当前的环境音。
- **fade** (可选): 淡出时长 (秒)。
- **示例**: `/tw_stop_ambient fade=5`