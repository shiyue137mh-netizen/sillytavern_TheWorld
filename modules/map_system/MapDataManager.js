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

                await this.lorebookManager.createOrUpdateNodeEntry(
                    this.bookName,
                    node.id,
                    node.name,
                    nodeDetails
                );

                this.nodes.set(node.id, { id: node.id, ...nodeDetails });

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
        
        await this.lorebookManager.createOrUpdateNodeEntry(
            this.bookName,
            nodeId,
            nodeInMemory.name,
            nodeDataForFile
        );
    }
}