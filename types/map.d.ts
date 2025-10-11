/**
 * @typedef {object} LocationNpc
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {object} MapNode - The content structure of a [MapNode:*] lorebook entry.
 * This represents any geographical entity, from a continent to a small landmark.
 * @property {string} [parentId] - The ID of the parent node. Root nodes do not have this.
 * @property {string} name - The display name of the node.
 * @property {string} [coords] - "x,y" coordinates (0-1000). Its meaning depends on the context:
 *    - For Outdoor nodes, it's the absolute position on the main world canvas.
 *    - For Indoor nodes, it's the relative position within the parent's dedicated indoor map view.
 * @property {'world' | 'continent' | 'region' | 'city' | 'town' | 'village' | 'district' | 'street' | 'building' | 'dungeon' | 'landmark' | 'shop' | 'house' | 'camp' | 'floor' | 'room' | 'area'} [type] - The type of the node, which determines its interaction model.
 *    - **室外节点 (Outdoor Nodes):** `world`, `continent`, `region`, `city`, `town`, `village`, `district`, `street`. These are all rendered on the main unified canvas. Clicking them does not trigger a drill-down.
 *    - **可进入的实体节点 (Enterable Entity Nodes):** `building`, `dungeon`, `landmark`, `shop`, `house`, `camp`. These appear on the Outdoor map. **Clicking them is the ONLY action that triggers a transition to an "Indoor" map view.**
 *    - **室内节点 (Indoor Nodes):** `floor`, `room`, `area`. These are only rendered when inside an "Indoor" map view, relative to their parent entity.
 * @property {string} [description] - A detailed description of the node.
 * @property {string} [illustration] - An image URL for a hover card for this node.
 * @property {'safe' | 'danger' | 'quest' | 'cleared' | 'locked'} [status] - Dynamic status of the node.
 * @property {LocationNpc[]} [npcs] - A list of NPCs currently at this node.
 * @property {number} [zoomThreshold] - The zoom level at which this node becomes visible. Lower values mean more important/visible from further out. Defaults are based on type.
 */

/**
 * @typedef {MapNode & {id: string}} MapNodeWithId - The complete node object as used in memory.
 */