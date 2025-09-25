/**
 * The World - Map System Main Entry Point
 * @description Initializes and orchestrates all map-related sub-modules.
 */

import { LorebookManager } from './LorebookManager.js';
import { MapDataManager } from './MapDataManager.js';
import { LocatorManager } from './LocatorManager.js';
import { CommandHandler } from './CommandHandler.js';
import { AtlasManager } from './AtlasManager.js';

export class MapSystem {
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.logger = dependencies.logger;
        this.logger.log('MapSystem constructor called.');

        this.lorebookManager = new LorebookManager(this.dependencies);
        this.mapDataManager = new MapDataManager({ ...this.dependencies, lorebookManager: this.lorebookManager });
        this.locatorManager = new LocatorManager({ ...this.dependencies, lorebookManager: this.lorebookManager, mapDataManager: this.mapDataManager });
        this.atlasManager = new AtlasManager({ ...this.dependencies, lorebookManager: this.lorebookManager, mapDataManager: this.mapDataManager });
        this.commandHandler = new CommandHandler({ ...this.dependencies, mapDataManager: this.mapDataManager, locatorManager: this.locatorManager });
        
        // The main UIRenderer is now solely responsible for map rendering.
        // No separate UIMapRenderer is created here anymore.
    }
    
    registerCommands() {
        this.commandHandler.registerCommands();
    }

    async initializeData(bookName) {
        this.logger.log('[MapSystem] Initializing data...');
        await this.mapDataManager.initialize(bookName);
        if (this.mapDataManager.isInitialized()) {
            await this.atlasManager.updateAtlas();
        }
        this.logger.success('[MapSystem] Data initialization complete.');
    }
}