/**
 * The World - UI Controller (Conductor)
 * @description Initializes and orchestrates all UI sub-modules.
 */
import { UIRenderer } from './UIRenderer.js';
import { UIDialogs } from './UIDialogs.js';
import { UIPanelManager } from './UIPanelManager.js';
import { UIEventManager } from './UIEventManager.js';
import { TimeAnimator } from './TimeAnimator.js';

export class UIController {
    constructor({ panelThemeManager, globalThemeManager, skyThemeController, audioManager, ...dependencies }) {
        this.dependencies = { ...dependencies, panelThemeManager, globalThemeManager, skyThemeController, audioManager };
        this.$ = dependencies.$;
        this.config = dependencies.config;
        this.state = dependencies.state;
        this.logger = dependencies.logger;

        const renderer = new UIRenderer(this.dependencies);
        const dialogs = new UIDialogs({ ...dependencies, renderer });
        this.panelManager = new UIPanelManager(dependencies);
        this.timeAnimator = new TimeAnimator(dependencies);
        
        const eventManager = new UIEventManager({
            ...this.dependencies,
            renderer: renderer,
            dialogs: dialogs,
            panelManager: this.panelManager,
            ui: this, 
        });

        this.renderer = renderer;
        this.dialogs = dialogs;
        this.eventManager = eventManager;
        this.panelThemeManager = panelThemeManager;
    }
    
    async init() {
        this.logger.log('UIController 初始化开始...');
        await this.loadPanelHtml();
        this.createToggleButton();
        this.panelManager.applyInitialPanelState();
        this.eventManager.bindAllEvents();
        this.applyFontSize();
        this.handleResize(); // Initial check
        this.logger.log('UIController 初始化完成。');
    }

    handleResize() {
        const isMobile = this.dependencies.win.innerWidth <= 768;
        this.$('body').toggleClass('tw-is-mobile-view', isMobile);
        this.logger.log(`[UI] Toggled mobile view class. Is mobile: ${isMobile}`);

        // Also notify the global theme manager to update its state
        if (this.dependencies.globalThemeManager.isActive) {
            this.dependencies.globalThemeManager.updateTheme();
        }
    }

    async loadPanelHtml() {
        const body = this.$('body');
        if (body.find(`#${this.config.PANEL_ID}`).length > 0) {
            this.logger.log('面板HTML已存在，跳过加载。');
            return;
        }
        try {
            this.logger.log('正在加载 panel.html...');
            const scriptUrl = new URL(import.meta.url);
            const basePath = scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/modules'));
            const panelUrl = `${basePath}/panel.html`;
            const response = await fetch(panelUrl);
            if (!response.ok) throw new Error(`获取 panel.html 失败: ${response.statusText}`);
            const panelHtml = await response.text();
            body.append(panelHtml);
            if (body.find(`#${this.config.FX_LAYER_ID}`).length === 0) {
                const $fxLayer = this.$('<div>').attr('id', this.config.FX_LAYER_ID);
                body.append($fxLayer);
            }
            this.logger.success('面板 HTML 加载并注入成功。');
            this.applyFontSize();
        } catch (error) {
            this.logger.error('严重: 面板 HTML 加载失败:', error);
        }
    }

    createToggleButton() {
        const $body = this.$('body');
        if ($body.find(`#${this.config.TOGGLE_BUTTON_ID}`).length > 0) return;
        this.logger.log('正在创建切换按钮...');
        // Create a container for the animated icon, instead of a simple emoji.
        const $toggleBtn = this.$('<div>').attr('id', this.config.TOGGLE_BUTTON_ID).attr('title', '仪表盘');
        $body.append($toggleBtn);
    }

    applyFontSize() {
        if (this.state.fontSize) {
            this.$(`#${this.config.PANEL_ID}`).css('--tw-font-size', this.state.fontSize);
        }
    }

    async updateAllPanes() {
        this.logger.log('正在更新所有面板内容...');
        const $wsPane = this.$('#world-state-pane').empty();
        const $mapPane = this.$('#map-nav-pane').empty();
        const $settingsPane = this.$('#settings-pane').empty();

        this.timeAnimator.stop();

        if (this.state.latestWorldStateData) {
            this.logger.log('检测到世界状态数据，正在渲染...');
            this.panelThemeManager.applyThemeAndEffects(this.state.latestWorldStateData);
            this.renderer.renderWorldStatePane($wsPane, this.state.latestWorldStateData);
            if (this.state.latestWorldStateData['时间']) {
                this.timeAnimator.start(this.state.latestWorldStateData['时间']);
            }
        } else {
            this.logger.log('无世界状态数据，显示等待信息。');
            this.panelThemeManager.weatherSystem.clearAllWeatherEffects(true);
            this.panelThemeManager.applyThemeAndEffects({}); // Apply default theme to button and panel
            $wsPane.html('<p class="tw-notice">等待世界状态数据...</p>');
        }

        // Render the new map pane
        await this.renderer.renderMapPane($mapPane);
        if (this.state.mapMode === 'advanced') {
            this.eventManager._updatePinVisibility();
        }


        this.renderer.renderSettingsPane($settingsPane);
        this.logger.log('所有面板内容更新完成。');
    }
}