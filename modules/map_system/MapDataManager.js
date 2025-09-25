/**
 * The World - Map Data Manager
 * @description Manages the in-memory "knowledge graph" of all maps and locations.
 * Handles data updates and serves as the single source of truth for the UI.
 */

export class MapDataManager {
    constructor({ logger, lorebookManager, ...dependencies }) {
        this.dependencies = dependencies;
        this.logger = logger;
        this.lorebookManager = lorebookManager;

        /** @type {Map<string, MapNodeWithId>} */
        this.nodes = new Map();
        
        this.bookName = null;
        this._isInitialized = false;
    }

    isInitialized() {
        return this._isInitialized;
    }

    async initialize(bookName) {
        this.logger.log('[MapDataManager] Initializing...');
        this.nodes.clear();
        this.bookName = bookName;
        
        if (!this.bookName) {
            this.logger.error('[MapDataManager] Initialization failed: No worldbook name provided.');
            return;
        }

        const nodeDefEntries = await this.lorebookManager.getAllNodeDefinitions(this.bookName);
        for (const entry of nodeDefEntries) {
            try {
                const nodeId = entry.name.match(/\[MapNode:(.*?)\]/)[1];
                const nodeData = JSON.parse(entry.content);
                this.nodes.set(nodeId, { id: nodeId, ...nodeData });
            } catch (error) {
                this.logger.error(`[MapDataManager] Failed to parse node definition from entry: ${entry.name}`, error);
            }
        }

        this.logger.success(`[MapDataManager] Loaded ${this.nodes.size} nodes into memory.`);
        this._isInitialized = true;
    }

    /**
     * Finds a map node by its ID or, as a fallback, by its name.
     * @param {string} idOrName The ID or name of the node.
     * @returns {MapNodeWithId|null} The found node or null.
     */
    findNodeByIdOrName(idOrName) {
        if (!idOrName) return null;
        if (this.nodes.has(idOrName)) {
            return this.nodes.get(idOrName);
        }
        for (const node of this.nodes.values()) {
            if (node.name === idOrName) {
                return node;
            }
        }
        return null;
    }

    /**
     * Builds a comprehensive list of keywords for a node, including its parent's info.
     * @param {MapNodeWithId} node The node to build keywords for.
     * @returns {string[]} An array of unique keywords.
     * @private
     */
    _buildKeywordsForNode(node) {
        const keywords = [node.id, node.name];
        if (node.parentId) {
            const parentNode = this.nodes.get(node.parentId);
            if (parentNode) {
                keywords.push(parentNode.id);
                keywords.push(parentNode.name);
            }
        }
        // Use a Set to ensure uniqueness and filter out any falsy values.
        return [...new Set(keywords.filter(Boolean))];
    }

    async processMapUpdate(updateData) {
        if (!Array.isArray(updateData)) {
            this.logger.warn('[MapDataManager] Invalid <MapUpdate> format received. Expected an array of nodes.', updateData);
            return;
        }
        
        if (!this.bookName) {
            this.logger.error('[MapDataManager] Cannot process map update, worldbook is not bound.');
            return;
        }

        for (const node of updateData) {
            if (!node.id) continue;

            if (node.op === 'add_or_update') {
                const { op, ...nodeDetails } = node;

                // Update in-memory data first to ensure parent data is available for keyword generation
                const nodeInMemory = this.nodes.get(node.id) || { id: node.id };
                Object.assign(nodeInMemory, nodeDetails);
                this.nodes.set(node.id, nodeInMemory);
                
                // Build keywords using the most up-to-date in-memory data
                const keywords = this._buildKeywordsForNode(nodeInMemory);
                const { id, ...nodeDataForFile } = nodeInMemory;

                await this.lorebookManager.createOrUpdateNodeEntry(
                    this.bookName,
                    node.id,
                    nodeInMemory.name,
                    nodeDataForFile,
                    keywords // Pass the generated keywords
                );

            } else if (node.op === 'remove') {
                await this.lorebookManager.deleteNodeEntry(this.bookName, node.id);
                this.nodes.delete(node.id);
            }
        }
        this.logger.success(`[MapDataManager] Processed an update with ${updateData.length} nodes.`);
    }

    async addNpcToLocation(nodeId, npc) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        if (!node.npcs) node.npcs = [];
        if (node.npcs.some(n => n.id === npc.id)) return;

        node.npcs.push(npc);
        await this.updateNodeDetail(nodeId, { npcs: node.npcs });
    }

    async removeNpcFromLocation(nodeId, npcId) {
        const node = this.nodes.get(nodeId);
        if (!node || !node.npcs) return;

        const initialCount = node.npcs.length;
        node.npcs = node.npcs.filter(n => n.id !== npcId);

        if (node.npcs.length < initialCount) {
            await this.updateNodeDetail(nodeId, { npcs: node.npcs });
        }
    }

    async updateNodeDetail(nodeId, detailUpdates) {
        const nodeInMemory = this.nodes.get(nodeId);
        if (!nodeInMemory) {
            this.logger.warn(`[MapDataManager] Cannot update detail for non-existent node: ${nodeId}`);
            return;
        }

        Object.assign(nodeInMemory, detailUpdates);
        
        const { id, ...nodeDataForFile } = nodeInMemory;
        const keywords = this._buildKeywordsForNode(nodeInMemory);
        
        await this.lorebookManager.createOrUpdateNodeEntry(
            this.bookName,
            nodeId,
            nodeInMemory.name,
            nodeDataForFile,
            keywords // Pass the generated keywords
        );
    }
}
