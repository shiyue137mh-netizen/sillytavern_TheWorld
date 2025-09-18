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
            triggerSlash: this.parentWin.triggerSlash,
            logger: this.logger,
            timeGradient: this.timeGradient,
        };

        const injectionEngine = new InjectionEngine(dependencies);
        dependencies.injectionEngine = injectionEngine;
        this.injectionEngine = injectionEngine; // Make it available on `this`

        this.dataManager = new DataManager(dependencies);
        this.stateParser = new StateParser(dependencies);
        
        const panelThemeManager = new PanelThemeManager(dependencies);
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
        
        // Replace the preloader with our time-lapse animation
        this.replacePreloaderWithTimeLapse();

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

    replacePreloaderWithTimeLapse() {
        const preloader = this.parentWin.document.getElementById('preloader');
        if (!preloader) {
            this.logger.warn('Preloader element not found. Cannot replace loading animation.');
            return;
        }
    
        this.logger.log('Replacing SillyTavern preloader with time-lapse animation...');
    
        // 1. Inject CSS for the new loader, ensuring it covers the old one
        const newLoaderCSS = `
            #preloader {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                z-index: 99999 !important; display: flex !important; flex-direction: column;
                align-items: center; justify-content: center;
                background-color: #1f2833 !important; /* Force solid background */
                transition: opacity 0.7s ease-out;
                overflow: hidden;
                opacity: 1 !important;
            }
            /* Explicitly hide the original spinner if present */
            #preloader #load-spinner, #preloader > .spinner {
                display: none !important;
            }
            .tw-loader-bg-layer {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                opacity: 0; transition: opacity 2.5s ease-in-out;
                background-size: 200% 200%;
                animation: bg-pan-loader 60s linear infinite alternate;
            }
            @keyframes bg-pan-loader { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }
            .tw-loader-content { z-index: 1; text-align: center; color: #fff; text-shadow: 0 1px 5px rgba(0,0,0,0.5); animation: fade-in-loader 1.5s ease-out; }
            @keyframes fade-in-loader { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .tw-loader-spinner { width: 100px; height: 100px; position: relative; margin: 0 auto 30px auto; }
            .tw-loader-spinner .orb { width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle, #a2fcf1 0%, #66fcf1 30%, #45a29e 100%); box-shadow: 0 0 20px #66fcf1, 0 0 40px #45a29e, inset 0 0 15px #fff; animation: orb-pulse-loader 2.5s infinite ease-in-out; }
            @keyframes orb-pulse-loader { 50% { transform: scale(1.05); box-shadow: 0 0 30px #a2fcf1, 0 0 60px #66fcf1, inset 0 0 15px #fff; } }
            .tw-loader-spinner .ring { position: absolute; top: 50%; left: 50%; border-radius: 50%; border-style: solid; border-color: #66fcf1 transparent transparent transparent; opacity: 0.8; }
            .tw-loader-spinner .ring-1 { width: 120%; height: 120%; margin-top: -60%; margin-left: -60%; border-width: 2px; animation: spin-loader 2s linear infinite; }
            .tw-loader-spinner .ring-2 { width: 140%; height: 140%; margin-top: -70%; margin-left: -70%; border-width: 1px; border-color: transparent #45a29e transparent transparent; animation: spin-loader 3.5s linear infinite reverse; }
            @keyframes spin-loader { to { transform: rotate(360deg); } }
            .tw-loader-text { font-size: 1.5em; letter-spacing: 2px; font-weight: 300; text-transform: uppercase; }
            .tw-loader-subtext { margin-top: 15px; font-size: 0.9em; color: #c5c6c7; min-height: 20px; font-style: italic; transition: opacity 0.5s ease-in-out; }
            .tw-loader-subtext.fade-out { opacity: 0; }
        `;
        this.injectionEngine.injectCss('the-world-loader-style', newLoaderCSS);
    
        // 2. Inject HTML Structure
        preloader.innerHTML = `
            <div class="tw-loader-bg-layer" id="tw-loader-bg1"></div>
            <div class="tw-loader-bg-layer" id="tw-loader-bg2"></div>
            <div class="tw-loader-content">
                <div class="tw-loader-spinner"><div class="orb"></div><div class="ring ring-1"></div><div class="ring ring-2"></div></div>
                <h2 class="tw-loader-text">THE WORLD</h2>
                <p class="tw-loader-subtext">Assembling Reality...</p>
            </div>
        `;
    
        // 3. Start Animation
        const bg1 = this.parentWin.document.getElementById('tw-loader-bg1');
        const bg2 = this.parentWin.document.getElementById('tw-loader-bg2');
        const subtextEl = this.parentWin.document.querySelector('.tw-loader-subtext');
        
        let activeLayer = 1;
        let lastUpdateTime = 0;
        const updateInterval = 500;
    
        let animState = { frameId: null, startTime: null, duration: 12000 };
        const loadingTexts = [ 'Assembling Reality...', 'Calibrating Atmosphere...', 'Rendering Celestial Bodies...', 'Generating Terrain...', 'Waking Inhabitants...' ];
        let textIndex = 0;
        let textTimeout;
    
        const changeSubtext = () => {
            if (!subtextEl) return;
            subtextEl.classList.add('fade-out');
            setTimeout(() => {
                textIndex = (textIndex + 1) % loadingTexts.length;
                subtextEl.textContent = loadingTexts[textIndex];
                subtextEl.classList.remove('fade-out');
                textTimeout = setTimeout(changeSubtext, 2500);
            }, 500);
        };
        textTimeout = setTimeout(changeSubtext, 2000);
    
        const animate = (timestamp) => {
            if (!animState.frameId) return; // Stop if cancelled
            if (!animState.startTime) animState.startTime = timestamp;
            const elapsed = timestamp - animState.startTime;
    
            if (timestamp - lastUpdateTime > updateInterval) {
                lastUpdateTime = timestamp;
                const progress = (elapsed % animState.duration) / animState.duration;
                const simulatedHour = progress * 24;
    
                const theme = this.timeGradient.getThemeForTime({ timeString: `${Math.floor(simulatedHour)}:${String(Math.floor((simulatedHour % 1) * 60)).padStart(2, '0')}` });
    
                if (activeLayer === 1) {
                    bg2.style.background = theme.background;
                    bg1.style.opacity = 0;
                    bg2.style.opacity = 1;
                    activeLayer = 2;
                } else {
                    bg1.style.background = theme.background;
                    bg2.style.opacity = 0;
                    bg1.style.opacity = 1;
                    activeLayer = 1;
                }
            }
            animState.frameId = requestAnimationFrame(animate);
        };
        animState.frameId = requestAnimationFrame(animate);
    
        // 4. Setup cleanup logic based on first load
        const cleanup = () => {
            if (animState.frameId === null) return; // Already cleaned up
            this.logger.success('Cleanup trigger received. Stopping loading animation.');
            
            cancelAnimationFrame(animState.frameId);
            animState.frameId = null;
            clearTimeout(textTimeout);
            
            if (preloader) {
                preloader.style.opacity = '0';
                setTimeout(() => {
                    preloader.remove();
                    this.injectionEngine.removeCss('the-world-loader-style');
                }, 700);
            }
        };
    
        let isAppReady = false;
        const appReadyListener = () => {
            this.logger.success('APP_READY event received.');
            isAppReady = true;
            if (TheWorldState.hasLoadedBefore) {
                cleanup();
            }
        };
        this.SillyTavernContext.eventSource.once(this.SillyTavernContext.eventTypes.APP_READY, appReadyListener);
    
        if (!TheWorldState.hasLoadedBefore) {
            this.logger.log('First load detected. Running full 12-second animation.');
            TheWorldState.hasLoadedBefore = true;
            this.dataManager.saveState();
            setTimeout(cleanup, 12000);
        } else {
            this.logger.log('Subsequent load. Animation will end when app is ready.');
            if (isAppReady) {
                 cleanup();
            }
        }
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