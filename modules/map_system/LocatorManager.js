/**
 * The World - Locator Manager
 * @description Manages the content of the [TheWorld:Locator] lorebook entry,
 * which provides the AI with real-time, summarized context about the map.
 */

export class LocatorManager {
    constructor({ logger, lorebookManager, mapDataManager }) {
        this.logger = logger;
        this.lorebookManager = lorebookManager;
        this.mapDataManager = mapDataManager;
        this.LOCATOR_ENTRY_NAME = '[TheWorld:Locator]';
    }

    async updateLocator(currentNodeId) {
        this.logger.log(`[LocatorManager] Updating locator for node: ${currentNodeId}`);
        const bookName = this.mapDataManager.bookName;
        if (!bookName) return;

        const currentNode = this.mapDataManager.nodes.get(currentNodeId);
        if (!currentNode) {
            this.logger.warn(`[LocatorManager] Cannot update locator, node "${currentNodeId}" not found.`);
            return;
        }

        // 1. Build Breadcrumbs
        const breadcrumbs = this._buildBreadcrumbs(currentNodeId);
        
        // 2. Get Siblings
        const siblings = this._getSiblings(currentNodeId);
        
        // 3. Get Children
        const children = this._getChildren(currentNodeId);

        // 4. Build Content
        let content = `[System Note: Your Current Location & Surroundings]\n`;
        content += `Path: ${breadcrumbs.map(b => `${b.name} (${b.id})`).join(' / ')}\n\n`;
        
        const { id, parentId, ...detailsToDisplay } = currentNode;
        content += `== Current Location: ${currentNode.name} ==\n`;
        content += `${JSON.stringify(detailsToDisplay, null, 2)}\n\n`;

        if (siblings.length > 0) {
            const parentName = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].name : 'the world';
            content += `== Nearby (at same level in ${parentName}) ==\n`;
            content += siblings.map(loc => `- ${loc.name} (${loc.id})`).join('\n');
            content += `\n\n`;
        }

        if (children.length > 0) {
            content += `== Places inside ${currentNode.name} ==\n`;
            content += children.map(loc => `- ${loc.name} (${loc.id})`).join('\n');
            content += `\n\n`;
        }

        // 5. Update Lorebook Entry
        const worldbook = await this.lorebookManager.TavernHelper.getWorldbook(bookName);
        const locatorEntry = worldbook.find(e => e.name === this.LOCATOR_ENTRY_NAME);

        if (!locatorEntry) {
            this.logger.log(`[LocatorManager] Creating new locator entry...`);
            await this.lorebookManager.createEntry(bookName, {
                name: this.LOCATOR_ENTRY_NAME,
                content: content,
                comment: 'Provides real-time map context to the AI. Do not edit manually.',
                strategy: { type: 'constant' },
                position: { type: 'before_character_definition', order: -1, role: 'system' }
            });
        } else {
            await this.lorebookManager.updateEntryContent(bookName, this.LOCATOR_ENTRY_NAME, content, false);
        }

        this.logger.success(`[LocatorManager] Locator entry updated successfully.`);
    }

    _buildBreadcrumbs(startNodeId) {
        const breadcrumbs = [];
        let currentNode = this.mapDataManager.nodes.get(startNodeId);
        while (currentNode) {
            breadcrumbs.unshift(currentNode);
            currentNode = currentNode.parentId ? this.mapDataManager.nodes.get(currentNode.parentId) : null;
        }
        return breadcrumbs;
    }

    _getSiblings(nodeId) {
        const node = this.mapDataManager.nodes.get(nodeId);
        if (!node) return [];
        return Array.from(this.mapDataManager.nodes.values())
            .filter(n => n.parentId === node.parentId && n.id !== nodeId);
    }

    _getChildren(nodeId) {
        return Array.from(this.mapDataManager.nodes.values())
            .filter(n => n.parentId === nodeId);
    }
}