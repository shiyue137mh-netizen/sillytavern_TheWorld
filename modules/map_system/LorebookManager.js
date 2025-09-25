/**
 * The World - Lorebook Manager
 * @description Handles all direct interactions with the SillyTavern Worldbook API.
 * This is the data persistence layer for the map system.
 */

export class LorebookManager {
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.logger = dependencies.logger;
        this.TavernHelper = dependencies.helper;
        this.context = dependencies.context;
        this.MAP_BOOK_NAME_PREFIX = '[TheWorld] MapNodes -';
    }

    async findBoundWorldbookName() {
        const charBooks = this.TavernHelper.getCharWorldbookNames('current');
        if (!charBooks) return null;
        const allBooks = [...(charBooks.additional || []), charBooks.primary].filter(Boolean);
        return allBooks.find(name => name.startsWith(this.MAP_BOOK_NAME_PREFIX)) || null;
    }

    async createAndBindMapWorldbook() {
        const freshContext = this.dependencies.win.SillyTavern.getContext();
        const charName = freshContext.name2;
        if (!charName || charName === 'SillyTavern System') {
            this.logger.error('[LorebookManager] Cannot create worldbook, invalid character context.', { charName });
            this.dependencies.toastr.error('无法创建地图档案：角色卡未完全加载或无效。请在进入聊天后重试。', '错误');
            return null;
        }
        const newBookName = `${this.MAP_BOOK_NAME_PREFIX} ${charName}`;
        this.logger.log(`[LorebookManager] Creating and binding new map book: ${newBookName}`);
        try {
            await this.TavernHelper.createWorldbook(newBookName);
            const charBooks = this.TavernHelper.getCharWorldbookNames('current');
            charBooks.additional.push(newBookName);
            await this.TavernHelper.rebindCharWorldbooks('current', charBooks);
            // await this._prefillTestData(newBookName); // Removed test data prefill
            return newBookName;
        } catch (error) {
            this.logger.error(`[LorebookManager] Failed to create or bind worldbook:`, error);
            return null;
        }
    }

    async getAllNodeDefinitions(bookName) {
        if (!bookName) return [];
        return this._getEntriesByPrefix(bookName, '[MapNode:');
    }

    async _getEntriesByPrefix(bookName, prefix) {
        try {
            const worldbook = await this.TavernHelper.getWorldbook(bookName);
            return worldbook.filter(entry => entry.name.startsWith(prefix));
        } catch (error) {
            this.logger.error(`[LorebookManager] Failed to get entries with prefix "${prefix}" from "${bookName}":`, error);
            return [];
        }
    }

    async updateEntryContent(bookName, entryName, newContent, isJson = true) {
        if (!bookName) return;
        try {
            await this.TavernHelper.updateWorldbookWith(bookName, (entries) => {
                const entry = entries.find(e => e.name === entryName);
                if (entry) {
                    entry.content = isJson ? JSON.stringify(newContent, null, 2) : newContent;
                }
                return entries;
            });
        } catch (error) {
            this.logger.error(`[LorebookManager] Failed to update entry "${entryName}" in "${bookName}":`, error);
        }
    }

    async createOrUpdateNodeEntry(bookName, nodeId, nodeName, nodeData) {
        const entryName = `[MapNode:${nodeId}]`;
        const content = JSON.stringify(nodeData, null, 2);
        
        const worldbook = await this.TavernHelper.getWorldbook(bookName);
        const existingEntry = worldbook.find(e => e.name === entryName);

        if (existingEntry) {
            await this.TavernHelper.updateWorldbookWith(bookName, entries => {
                const entryToUpdate = entries.find(e => e.name === entryName);
                if (entryToUpdate) {
                    entryToUpdate.content = content;
                    entryToUpdate.strategy.keys = [nodeId, nodeName];
                }
                return entries;
            });
        } else {
            await this.createEntry(bookName, {
                name: entryName,
                content: content,
                keys: [nodeId, nodeName],
                strategy: { type: 'selective' },
                comment: `Details for node: ${nodeName}. Auto-generated.`
            });
        }
    }

    async createEntry(bookName, entryData) {
        if (!bookName) return;
        try {
            await this.TavernHelper.createWorldbookEntries(bookName, [entryData]);
            this.logger.log(`[LorebookManager] Created new entry in "${bookName}":`, entryData.name);
        } catch (error) {
            this.logger.error(`[LorebookManager] Failed to create entry in "${bookName}":`, error);
        }
    }

    async deleteNodeEntry(bookName, nodeId) {
        if (!bookName) return;
        const entryName = `[MapNode:${nodeId}]`;
        try {
            await this.TavernHelper.deleteWorldbookEntries(bookName, entry => entry.name === entryName);
            this.logger.log(`[LorebookManager] Deleted entry "${entryName}" from "${bookName}".`);
        } catch (error) {
            this.logger.error(`[LorebookManager] Failed to delete entry "${entryName}" from "${bookName}":`, error);
        }
    }
}