/**
 * The World - Main Application Class
 * @description Orchestrates the initialization and communication of all modules.
 */

import { TheWorldState } from './state.js';
import { DataManager } from './core/DataManager.js';
import { UIController } from './ui/UIController.js';
import { StateParser } from './state_parser/index.js';
import { Config } from '../config.js';
import { Logger } from './logger.js';
import { ThemeManager as PanelThemeManager } from './core/ThemeManager.js';
import { GlobalThemeManager } from './core/GlobalThemeManager.js';
import { InjectionEngine } from './core/InjectionEngine.js';
import { TimeGradient } from './time_gradient/index.js';
import { SkyThemeController } from './core/SkyThemeController.js';
import { IntroAnimation } from './IntroAnimation.js';
import { AudioManager } from './audio/index.js';
import { CommandParser } from './core/CommandParser.js';
import { CommandProcessor } from './core/CommandProcessor.js';
import { MapSystem } from './map_system/index.js';
import { MacroManager } from './api/MacroManager.js';
import { CommandManager } from './api/CommandManager.js';


export class TheWorldApp {
    constructor() {
        this.parentWin = window.parent;
        this.SillyTavern = this.parentWin.SillyTavern;
        this.TavernHelper = this.parentWin.TavernHelper;
        this.jQuery = this.parentWin.jQuery;
        this.SillyTavernContext = this.SillyTavern.getContext();
        
        this.processorTimeout = null;
        this.previousStateSnapshot = null;
        this.dependencies = {}; // To be populated in initialize

        this.logger = Logger;
        this.logger.log('TheWorldApp constructor called.');
        this.initialize();
    }

    async initialize() {
        this.logger = Logger;
        this.logger.log(`[The World v${Config.VERSION}] Initializing...`);
        this.config = Config;
        
        // Create the single source of truth for time-based colors
        this.timeGradient = new TimeGradient();

        // Store all dependencies in a single object for easy passing
        this.dependencies = {
            $: this.jQuery,
            win: this.parentWin,
            context: this.SillyTavernContext,
            helper: this.TavernHelper,
            config: this.config,
            state: TheWorldState,
            triggerSlash: this.parentWin.TavernHelper.triggerSlash,
            logger: this.logger,
            timeGradient: this.timeGradient,
            toastr: this.parentWin.toastr,
        };

        const injectionEngine = new InjectionEngine(this.dependencies);
        this.dependencies.injectionEngine = injectionEngine;
        this.injectionEngine = injectionEngine;

        this.dataManager = new DataManager(this.dependencies);
        this.dependencies.dataManager = this.dataManager;
        this.stateParser = new StateParser(this.dependencies);
        
        const audioManager = new AudioManager(this.dependencies);
        this.audioManager = audioManager;
        this.dependencies.audioManager = audioManager;
        
        this.commandParser = new CommandParser(this.dependencies);
        
        // Initialize Map System
        this.mapSystem = new MapSystem(this.dependencies);
        this.dependencies.mapSystem = this.mapSystem;
        // DEFER command registration until API is ready
        
        this.commandProcessor = new CommandProcessor({ audioManager, mapSystem: this.mapSystem, logger: this.logger });
        
        const panelThemeManager = new PanelThemeManager(this.dependencies);
        this.panelThemeManager = panelThemeManager;
        const globalThemeManager = new GlobalThemeManager(this.dependencies);
        this.globalThemeManager = globalThemeManager;
        
        this.dependencies.panelThemeManager = panelThemeManager;
        this.dependencies.globalThemeManager = globalThemeManager;
        
        this.skyThemeController = new SkyThemeController({
            ...this.dependencies,
            dataManager: this.dataManager
        });
        this.dependencies.skyThemeController = this.skyThemeController;

        this.dataManager.loadState();
        await this.skyThemeController.init();
        this.introAnimation = new IntroAnimation(this.dependencies);
        await this.introAnimation.run();

        this.uiController = new UIController({ 
            ...this.dependencies,
            dataManager: this.dataManager,
        });
        this.dependencies.uiController = this.uiController;

        // DEFERRED: MacroManager and CommandManager are now initialized in finalizeApiInitialization

        await this.uiController.init(); 

        if (TheWorldState.isGlobalThemeEngineEnabled) {
            this.logger.log("全局主题引擎在启动时已启用，正在激活...");
            this.globalThemeManager.activate();
        }

        if (TheWorldState.isPanelVisible) {
            this.uiController.panelManager.togglePanel(true);
        }

        this.setupEventListeners();
        
        const unlockHandler = () => {
            this.audioManager.unlockAudio();
        };
        this.parentWin.document.addEventListener('click', unlockHandler, { once: true, capture: true });
        this.parentWin.document.addEventListener('keydown', unlockHandler, { once: true, capture: true });

        
        this.parentWin.tw_debug = {
            triggerEffect: (effectName) => this.panelThemeManager.weatherSystem.triggerEffect(effectName)
        };
        
        const bookName = await this.mapSystem.lorebookManager.findBoundWorldbookName();
        if (bookName) {
            await this.mapSystem.initializeData(bookName);
            await this.mapSystem.locatorManager.initializePlayerLocation();
        }

        const lastId = this.TavernHelper.getLastMessageId();
        if (lastId >= 0) {
            this.logger.log(`Existing chat detected. Performing initial state calculation...`);
            await this.recalculateAndSnapshot(lastId);
        } else {
            this.logger.log(`New chat detected. Updating UI with default state.`);
            if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
            await this.uiController.updateAllPanes();
        }
        
        this.logger.success(`[The World v${Config.VERSION}] Initialization complete.`);
    }

    /**
     * Initializes modules that depend on late-loading SillyTavern APIs.
     * This is triggered by the 'EXTRAS_CONNECTED' event.
     */
    finalizeApiInitialization() {
        this.logger.log('[API] EXTRAS_CONNECTED event received. Finalizing API-dependent initialization...');
        
        // Now it's safe to initialize these modules
        this.mapSystem.registerCommands();

        this.macroManager = new MacroManager(this.dependencies);
        this.macroManager.registerAll();
        
        this.commandManager = new CommandManager(this.dependencies);
        this.commandManager.registerAll();
    }

    debouncedProcessor(msgId, isReprocessing = false) {
        clearTimeout(this.processorTimeout);
        this.processorTimeout = setTimeout(async () => {
            this.logger.log(`[Processor] Running for ID: ${msgId}. Is Reprocessing: ${isReprocessing}`);

            if (isReprocessing && this.previousStateSnapshot) {
                this.logger.log('Edit/Swipe detected. Rolling back to previous state snapshot.');
                TheWorldState.latestWorldStateData = this.jQuery.extend(true, {}, this.previousStateSnapshot.worldState);
                TheWorldState.latestMapData = this.jQuery.extend(true, {}, this.previousStateSnapshot.map);
                if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
            }

            this.logger.log('Taking new state snapshot...');
            this.previousStateSnapshot = {
                worldState: this.jQuery.extend(true, {}, TheWorldState.latestWorldStateData),
                map: this.jQuery.extend(true, {}, TheWorldState.latestMapData)
            };
            
            await this.processSingleMessage(msgId);

        }, 350);
    }
    
    async processSingleMessage(msgId) {
        try {
            const messages = this.TavernHelper.getChatMessages(msgId, { "role": "all", "hide_state": "all", "include_swipes": false });
            if (!messages || messages.length === 0 || messages[0].is_user) { return; }

            const msg = messages[0].message;

            // Handle non-persistent ambient sound logic BEFORE processing new commands
            this.audioManager.processMessage(msg);
            
            // Execute audio and other FX commands
            const commands = this.commandParser.parse(msg);
            if (commands.length > 0) {
                this.commandProcessor.executeCommands(commands);
            }

            const sanitizedMes = msg.replace(/<thinking>[\s\S]*?<\/thinking>|<think>[\s\S]*?<\/think>/g, '');
            
            let updated = false;

            // --- CORRECTED <MapUpdate> Handling ---
            const mapUpdateMatch = sanitizedMes.match(this.config.MAP_UPDATE_TAG_REGEX);
            if (mapUpdateMatch) {
                try {
                    const updateJson = JSON.parse(mapUpdateMatch[1]);
                    this.logger.log('Parsed <MapUpdate> tag:', updateJson);

                    if (!this.mapSystem.mapDataManager.isInitialized()) {
                        let bookName = await this.mapSystem.lorebookManager.findBoundWorldbookName();
                        if (!bookName) {
                            this.logger.log('No map worldbook found, creating one on-demand...');
                            bookName = await this.mapSystem.lorebookManager.createAndBindMapWorldbook();
                        }
                        
                        if (bookName) {
                            await this.mapSystem.mapDataManager.initialize(bookName);
                        } else {
                            this.logger.error('Failed to find or create a map worldbook. Cannot process <MapUpdate>.');
                        }
                    }

                    if (this.mapSystem.mapDataManager.isInitialized()) {
                        await this.mapSystem.mapDataManager.processMapUpdate(updateJson);
                        await this.mapSystem.atlasManager.updateAtlas(); // Update the Atlas after map changes
                        updated = true;
                    }

                } catch (error) {
                    this.logger.error('Failed to parse or process <MapUpdate> tag:', error);
                }
            }
            
            const worldStateMatch = sanitizedMes.match(this.config.WORLD_STATE_TAG_REGEX);
            if (worldStateMatch) {
                const newWorldStateData = this.stateParser.parseWorldState(worldStateMatch[1]);
                if (typeof TheWorldState.latestWorldStateData !== 'object' || TheWorldState.latestWorldStateData === null) {
                    TheWorldState.latestWorldStateData = {};
                }
                Object.assign(TheWorldState.latestWorldStateData, newWorldStateData);
                updated = true;

                // NEW: Implicit Location Update Logic
                const newLocationName = newWorldStateData['地点'];
                const hasExplicitMoveCommand = commands.some(cmd => 
                    cmd.module === 'Map' && 
                    cmd.function === 'SetProperty' && 
                    cmd.args[0] === 'player_location'
                );

                if (newLocationName && !hasExplicitMoveCommand && this.mapSystem.mapDataManager.isInitialized()) {
                    const targetNode = this.mapSystem.mapDataManager.findNodeByIdOrName(newLocationName);
                    if (targetNode && targetNode.id !== this.state.currentPlayerLocationId) {
                        this.logger.log(`[WorldState] Implicitly updating player location to "${newLocationName}" (ID: ${targetNode.id})`);
                        await this.mapSystem.locatorManager.updateLocator(targetNode.id);
                        // 'updated' is already true, so UI will refresh.
                    }
                }
            }

            if (updated) {
                this.dataManager.saveState();
                this.logger.log(`[Processor] WorldState from message ${msgId} processed. Updating UI.`);
                if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
            }
            
            if (this.uiController) {
                await this.uiController.updateAllPanes();
            }

        } catch (error) {
            this.logger.error(`[Processor] Error processing message ID ${msgId}:`, error);
        }
    }

    async recalculateAndSnapshot(lastId) {
        this.logger.log('[Recalculator] Performing initial state calculation and snapshot...');
        
        TheWorldState.latestMapData = {};
        TheWorldState.latestWorldStateData = {};

        const allMessages = lastId > 0
            ? this.TavernHelper.getChatMessages(`0-${lastId}`, { "role": "all", "hide_state": "all", "include_swipes": false })
            : this.TavernHelper.getChatMessages(0, { "role": "all", "hide_state": "all", "include_swipes": false });

        if (!allMessages) {
             this.logger.error('[Recalculator] Could not retrieve messages for recalculation.');
             return;
        }

        for (let i = 0; i < allMessages.length - 1; i++) {
            const message = allMessages[i];
            if (message.is_user) continue;
            
            const msg = message.message.replace(/<thinking>[\s\S]*?<\/thinking>|<think>[\s\S]*?<\/think>/g, '');
            // NOTE: <MapUpdate> is not processed during recalculation to avoid re-processing persistent data.
            // Recalculation is primarily for transient state like WorldState.
            
            const worldStateMatch = msg.match(this.config.WORLD_STATE_TAG_REGEX);
            if (worldStateMatch) Object.assign(TheWorldState.latestWorldStateData, this.stateParser.parseWorldState(worldStateMatch[1]));
        }
        
        this.logger.log('Taking initial snapshot...');
        this.previousStateSnapshot = {
            worldState: this.jQuery.extend(true, {}, TheWorldState.latestWorldStateData),
            map: this.jQuery.extend(true, {}, TheWorldState.latestMapData)
        };
        
        await this.processSingleMessage(lastId);
        if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
        this.logger.success('[Recalculator] Initial state calculated and ready.');
    }

    setupEventListeners() {
        const { eventSource, eventTypes } = this.SillyTavernContext;

        // CRITICAL: Listen for the signal that all extension APIs are ready
        eventSource.once(eventTypes.EXTRAS_CONNECTED, () => this.finalizeApiInitialization());

        eventSource.on(eventTypes.MESSAGE_RECEIVED, (id) => this.debouncedProcessor(id, false));
        eventSource.on(eventTypes.MESSAGE_EDITED, (id) => this.debouncedProcessor(id, true)); 
        eventSource.on(eventTypes.MESSAGE_SWIPED, (id) => this.debouncedProcessor(id, true)); 
        
        eventSource.on(eventTypes.MESSAGE_DELETED, async (id) => {
            const lastMessageId = await this.TavernHelper.getLastMessageId();
            if (id === lastMessageId + 1 && this.previousStateSnapshot) {
                 this.logger.log(`Last message (ID: ${id}) deleted. Rolling back to previous state snapshot.`);
                 TheWorldState.latestWorldStateData = this.jQuery.extend(true, {}, this.previousStateSnapshot.worldState);
                 TheWorldState.latestMapData = this.jQuery.extend(true, {}, this.previousStateSnapshot.map);
                 this.previousStateSnapshot = null;
                 
                 this.dataManager.saveState();
                 if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
                 if (this.uiController) {
                    await this.uiController.updateAllPanes();
                 }
            } else {
                 this.logger.log(`A historical message (ID: ${id}) was deleted. Triggering full recalculation.`);
                 const currentLastId = await this.TavernHelper.getLastMessageId();
                 if (currentLastId >= 0) {
                     await this.recalculateAndSnapshot(currentLastId);
                 } else {
                     TheWorldState.latestMapData = {};
                     TheWorldState.latestWorldStateData = {};
                     this.previousStateSnapshot = null;
                     this.dataManager.saveState();
                     if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
                     if (this.uiController) {
                        await this.uiController.updateAllPanes();
                     }
                 }
            }
        });

        eventSource.on(eventTypes.CHAT_CHANGED, async () => {
            this.logger.log('Chat changed. Clearing snapshot and recalculating for new chat.');
            this.previousStateSnapshot = null;

            // Proactively initialize map data for the new chat
            const bookName = await this.mapSystem.lorebookManager.findBoundWorldbookName();
            if (bookName) {
                await this.mapSystem.initializeData(bookName);
                await this.mapSystem.locatorManager.initializePlayerLocation();
            } else {
                // If no book, clear the data manager's state to prevent showing old map data
                this.mapSystem.mapDataManager.nodes.clear();
                this.mapSystem.mapDataManager.bookName = null;
                this.mapSystem.mapDataManager._isInitialized = false;
                await this.mapSystem.atlasManager.updateAtlas(); // Update to show an empty atlas
            }

            const lastId = this.TavernHelper.getLastMessageId();
            if (lastId >= 0) {
                await this.recalculateAndSnapshot(lastId);
            } else {
                TheWorldState.latestMapData = {};
                TheWorldState.latestWorldStateData = {};
                this.dataManager.saveState();
                if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
                if (this.uiController) {
                    await this.uiController.updateAllPanes();
                }
            }
        });
    }
}
