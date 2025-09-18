

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
        
        this.runIntroAnimation();

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

    runIntroAnimation() {
        if (TheWorldState.hasLoadedBefore) {
            this.logger.log('[世界] Not the first load, skipping intro animation.');
            return;
        }
    
        this.logger.log('[世界] 首次加载，创建诗歌加载动画...');
        
        const $overlay = this.jQuery('<div>').attr('id', 'tw-custom-loader-overlay');
        
        const newLoaderCSS = `
            #preloader { display: none !important; }
            #tw-custom-loader-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                z-index: 999999 !important;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                background-color: #000;
                transition: opacity 1.5s ease-out;
                overflow: hidden;
            }
            .tw-loader-bg-layer {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                opacity: 0; transition: opacity 5s ease-in-out;
                background-size: 200% 200%;
                animation: bg-pan-loader 90s linear infinite alternate;
            }
            @keyframes bg-pan-loader { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }
            
            .tw-loader-poetry-container {
                position: relative; width: 80%; max-width: 700px; height: 200px; /* Give it a fixed height */
                text-align: center; font-family: "Georgia", "Times New Roman", serif;
                z-index: 10;
            }

            .poem-wrapper {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                opacity: 0; /* Start hidden */
            }
            
            .poem-line { margin: 0.2em 0; line-height: 1.7; text-shadow: 0 1px 4px rgba(0,0,0,0.7); }
            .poem-original { font-size: 1.2em; color: rgba(255, 255, 255, 0.95); font-weight: 400; }
            .poem-translation { font-size: 1em; color: rgba(255, 255, 255, 0.65); font-style: italic; }
            
            .poem-attribution {
                width: 100%;
                text-align: right;
                margin-top: 2em;
                padding-right: 1em;
                font-size: 0.8em; color: rgba(255, 255, 255, 0.5);
                z-index: 10;
            }

            @keyframes fade-in-out-poem {
                0% { opacity: 0; transform: translateY(10px); }
                15% { opacity: 1; transform: translateY(0); }
                85% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
        `;
        this.injectionEngine.injectCss('the-world-loader-style', newLoaderCSS);
    
        const poems = [
            { // 0 - 7.5s: Night
                html: `<p class="poem-line poem-original">La noche está estrellada,</p><p class="poem-line poem-translation">夜在天空中布满星辰，</p><p class="poem-line poem-original">y tiritan, azules, los astros, a lo lejos.</p><p class="poem-line poem-translation">蓝色的星群，在远方颤抖。</p>`,
                attribution: '— 巴勃罗·聂鲁达 《二十首情诗和一首绝望的歌》',
            },
            { // 7.5s - 15s: Sunrise
                html: `<p class="poem-line poem-original">The sky filled slowly with shades of violet and rose,</p><p class="poem-line poem-translation">天空缓缓充满了紫罗兰与玫瑰的色调，</p><p class="poem-line poem-original">and the hills were purple.</p><p class="poem-line poem-translation">远山呈现一片黛紫。</p>`,
                attribution: '— 弗吉尼亚·伍尔夫 《到灯塔去》(To the Lighthouse)',
            },
            { // 15s - 22.5s: Daytime
                html: `<p class="poem-line poem-original">Higher still and higher</p><p class="poem-line poem-translation">飞得更高，更高，</p><p class="poem-line poem-original">Like a cloud of fire;</p><p class="poem-line poem-translation">像一团燃烧的火云；</p><p class="poem-line poem-original">The blue deep thou wingest...</p><p class="poem-line poem-translation">你鼓翼穿行于蔚蓝的深空...</p>`,
                attribution: '— 雪莱 《致云雀》(To a Skylark)',
            },
            { // 22.5s - 30s: Dusk
                html: `<p class="poem-line poem-original">La tarde que se inclina sobre el mundo</p><p class="poem-line poem-translation">这黄昏斜倚向世界</p><p class="poem-line poem-original">es de una luz que es casi una memoria;</p><p class="poem-line poem-translation">它的光几乎就是一种记忆；</p>`,
                attribution: '— 豪尔赫·路易斯·博尔赫斯 《黄昏》 (Un Atardecer)',
            }
        ];
        
        let poetryHtml = '';
        poems.forEach((p, i) => {
            poetryHtml += `
                <div class="poem-wrapper" id="poem-${i}" style="animation: fade-in-out-poem 7.5s ease-in-out forwards; animation-delay: ${i * 7.5}s;">
                    <div>${p.html}</div>
                    <div class="poem-attribution">${p.attribution}</div>
                </div>`;
        });

        $overlay.html(`
            <div class="tw-loader-bg-layer" id="tw-loader-bg1"></div>
            <div class="tw-loader-bg-layer" id="tw-loader-bg2"></div>
            <div class="tw-loader-poetry-container">${poetryHtml}</div>
        `);
        this.jQuery('body').prepend($overlay);

        const bg1 = this.parentWin.document.getElementById('tw-loader-bg1');
        const bg2 = this.parentWin.document.getElementById('tw-loader-bg2');
        const animState = { frameId: null, startTime: null, duration: 30000, activeBgLayer: 1 };

        const animateBg = (timestamp) => {
            if (animState.frameId === null) return;
            if (!animState.startTime) animState.startTime = timestamp;
            const elapsed = timestamp - animState.startTime;
            const progress = Math.min(elapsed / animState.duration, 1);
            const simulatedHour = progress * 24;
            const theme = this.timeGradient.getThemeForTime({ timeString: `${Math.floor(simulatedHour)}:${String(Math.floor((simulatedHour % 1) * 60)).padStart(2, '0')}` });

            if (animState.activeBgLayer === 1) {
                if (bg2.style.background !== theme.background) {
                    bg2.style.background = theme.background;
                    bg1.style.opacity = 0; bg2.style.opacity = 1; animState.activeBgLayer = 2;
                }
            } else {
                if (bg1.style.background !== theme.background) {
                    bg1.style.background = theme.background;
                    bg2.style.opacity = 0; bg1.style.opacity = 1; animState.activeBgLayer = 1;
                }
            }

            if(elapsed < animState.duration) {
                animState.frameId = requestAnimationFrame(animateBg);
            }
        };

        const cleanup = () => {
            this.logger.success('[世界] 加载动画结束，正在清理。');
            cancelAnimationFrame(animState.frameId);
            animState.frameId = null;
            $overlay.css('opacity', '0');
            setTimeout(() => {
                $overlay.remove();
                this.injectionEngine.removeCss('the-world-loader-style');
                this.logger.log('[世界] 设置 hasLoadedBefore 为 true 并保存。');
                TheWorldState.hasLoadedBefore = true;
                this.dataManager.saveState();
            }, 1500); // Wait for fade-out transition
        };
        
        // Main cleanup timer
        setTimeout(cleanup, 30000); 

        // Animate Background
        const initialTheme = this.timeGradient.getThemeForTime({ timeString: '0:00' });
        bg1.style.background = initialTheme.background;
        bg1.style.opacity = 1;
        animState.frameId = requestAnimationFrame(animateBg);
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