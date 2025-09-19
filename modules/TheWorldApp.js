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


export class TheWorldApp {
    constructor() {
        this.parentWin = window.parent;
        this.SillyTavern = this.parentWin.SillyTavern;
        this.TavernHelper = this.parentWin.TavernHelper;
        this.jQuery = this.parentWin.jQuery;
        this.SillyTavernContext = this.SillyTavern.getContext();
        
        this.processorTimeout = null;
        this.previousStateSnapshot = null;

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

        const dependencies = {
            $: this.jQuery,
            win: this.parentWin,
            context: this.SillyTavernContext,
            helper: this.TavernHelper,
            config: this.config,
            state: TheWorldState,
            triggerSlash: this.parentWin.TavernHelper.triggerSlash,
            logger: this.logger,
            timeGradient: this.timeGradient,
        };

        const injectionEngine = new InjectionEngine(dependencies);
        dependencies.injectionEngine = injectionEngine;
        this.injectionEngine = injectionEngine;

        this.dataManager = new DataManager(dependencies);
        dependencies.dataManager = this.dataManager;
        this.stateParser = new StateParser(dependencies);
        
        const audioManager = new AudioManager(dependencies);
        this.audioManager = audioManager;
        dependencies.audioManager = audioManager;
        
        this.commandParser = new CommandParser(dependencies);
        this.commandProcessor = new CommandProcessor({ audioManager, logger: this.logger });

        const panelThemeManager = new PanelThemeManager(dependencies);
        this.panelThemeManager = panelThemeManager;
        const globalThemeManager = new GlobalThemeManager(dependencies);
        this.globalThemeManager = globalThemeManager;
        
        dependencies.panelThemeManager = panelThemeManager;
        dependencies.globalThemeManager = globalThemeManager;
        
        this.skyThemeController = new SkyThemeController({
            ...dependencies,
            dataManager: this.dataManager
        });
        dependencies.skyThemeController = this.skyThemeController;

        // --- New Init Sequence ---
        this.dataManager.loadState();
        await this.skyThemeController.init();
        this.introAnimation = new IntroAnimation(dependencies);
        await this.introAnimation.run();

        this.uiController = new UIController({ 
            ...dependencies,
            dataManager: this.dataManager,
        });
        await this.uiController.init(); 

        if (TheWorldState.isGlobalThemeEngineEnabled) {
            this.logger.log("全局主题引擎在启动时已启用，正在激活...");
            this.globalThemeManager.activate();
        }

        if (TheWorldState.isPanelVisible) {
            this.uiController.panelManager.togglePanel(true);
        }

        this.setupEventListeners();
        
        // Global Audio Unlocker: Ensure AudioContext is started on the first user interaction.
        const unlockHandler = () => {
            this.audioManager.unlockAudio();
            // These listeners are { once: true }, so they remove themselves automatically.
            // No need for manual removal.
        };
        // Use `capture: true` to catch the event early before it might be stopped by other scripts.
        this.parentWin.document.addEventListener('click', unlockHandler, { once: true, capture: true });
        this.parentWin.document.addEventListener('keydown', unlockHandler, { once: true, capture: true });

        
        this.parentWin.tw_debug = {
            triggerEffect: (effectName) => this.panelThemeManager.weatherSystem.triggerEffect(effectName)
        };
        
        const lastId = this.TavernHelper.getLastMessageId();
        if (lastId >= 0) {
            this.logger.log(`Existing chat detected. Performing initial state calculation...`);
            await this.recalculateAndSnapshot(lastId);
        } else {
            this.logger.log(`New chat detected. Updating UI with default state.`);
            if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
            this.uiController.updateAllPanes();
        }
        
        this.logger.success(`[The World v${Config.VERSION}] Initialization complete.`);
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

            const mapMatch = sanitizedMes.match(this.config.MAP_TAG_REGEX);
            if (mapMatch) {
                const newMapData = this.stateParser.parseMapData(mapMatch[1]);
                if (typeof TheWorldState.latestMapData !== 'object' || TheWorldState.latestMapData === null) {
                    TheWorldState.latestMapData = {};
                }
                Object.assign(TheWorldState.latestMapData, newMapData);
                updated = true;
            }

            const worldStateMatch = sanitizedMes.match(this.config.WORLD_STATE_TAG_REGEX);
            if (worldStateMatch) {
                const newWorldStateData = this.stateParser.parseWorldState(worldStateMatch[1]);
                if (typeof TheWorldState.latestWorldStateData !== 'object' || TheWorldState.latestWorldStateData === null) {
                    TheWorldState.latestWorldStateData = {};
                }
                Object.assign(TheWorldState.latestWorldStateData, newWorldStateData);
                updated = true;
            }

            if (updated) {
                this.dataManager.saveState();
                this.logger.log(`[Processor] Data from message ${msgId} processed and merged. Updating UI.`);
                if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
            }
            
            if (this.uiController) {
                this.uiController.updateAllPanes();
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
            const mapMatch = msg.match(this.config.MAP_TAG_REGEX);
            if (mapMatch) Object.assign(TheWorldState.latestMapData, this.stateParser.parseMapData(mapMatch[1]));
            
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
                    this.uiController.updateAllPanes();
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
                        this.uiController.updateAllPanes();
                     }
                 }
            }
        });

        eventSource.on(eventTypes.CHAT_CHANGED, async () => {
            this.logger.log('Chat changed. Clearing snapshot and recalculating for new chat.');
            this.previousStateSnapshot = null;
            const lastId = this.TavernHelper.getLastMessageId();
            if (lastId >= 0) {
                await this.recalculateAndSnapshot(lastId);
            } else {
                TheWorldState.latestMapData = {};
                TheWorldState.latestWorldStateData = {};
                this.dataManager.saveState();
                if (this.globalThemeManager.isActive) this.globalThemeManager.updateTheme();
                if (this.uiController) {
                    this.uiController.updateAllPanes();
                }
            }
        });
    }
}