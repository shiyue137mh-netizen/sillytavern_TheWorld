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
 * @property {string} [coords] - "x,y" coordinates (0-1000) relative to the parent's map view.
 * @property {string} [type] - e.g., 'region', 'city', 'landmark', 'dungeon'. Used for UI icons/styling.
 * @property {string} [description] - A detailed description of the node.
 * @property {string} [mapImage] - A background image URL if this node can be viewed as a map container for its children.
 * @property {string} [illustration] - An image URL for a hover card for this node.
 * @property {'safe' | 'danger' | 'quest' | 'cleared' | 'locked'} [status] - Dynamic status of the node.
 * @property {LocationNpc[]} [npcs] - A list of NPCs currently at this node.
 * @property {string} [pin_image] - Custom image for the map pin.
 */

/**
 * @typedef {MapNode & {id: string}} MapNodeWithId - The complete node object as used in memory.
 */