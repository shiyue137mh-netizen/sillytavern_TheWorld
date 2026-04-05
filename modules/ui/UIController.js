/**
 * The World - UI Controller (Conductor)
 * @description Initializes and orchestrates all UI sub-modules.
 */
import { Icons } from '../utils/icons.js';
import { MapEditorManager } from './MapEditorManager.js';
import { MapViewportManager } from './MapViewportManager.js';
import { TimeAnimator } from './TimeAnimator.js';
import { UIDialogs } from './UIDialogs.js';
import { UIEventManager } from './UIEventManager.js';
import { UIPanelManager } from './UIPanelManager.js';
import { UIRenderer } from './UIRenderer.js';

export class UIController {
    constructor(dependencies) {
        this.dependencies = dependencies;
        this.$ = dependencies.$;
        this.config = dependencies.config;
        this.state = dependencies.state;
        this.logger = dependencies.logger;

        // Instantiate all UI sub-modules in the correct order
        const mapViewportManager = new MapViewportManager(this.dependencies);
        const renderer = new UIRenderer({ ...this.dependencies, mapViewportManager });
        const dialogs = new UIDialogs({ ...this.dependencies, renderer });
        const mapEditorManager = new MapEditorManager({
            ...this.dependencies,
            dialogs, // Pass the created dialogs instance
            renderer,
            viewportManager: mapViewportManager,
        });
        this.panelManager = new UIPanelManager(this.dependencies);
        this.timeAnimator = new TimeAnimator(this.dependencies);

        // UIEventManager is the conductor, it gets all other modules
        const eventManager = new UIEventManager({
            ...this.dependencies,
            ui: this,
            renderer,
            dialogs,
            panelManager: this.panelManager,
            mapViewportManager,
            mapEditorManager,
        });

        // Assign to class properties
        this.renderer = renderer;
        this.dialogs = dialogs;
        this.eventManager = eventManager;
        this.panelThemeManager = dependencies.panelThemeManager;
    }

    async init() {
        this.logger.log('UIController 初始化开始...');

        // Inject Google Fonts (Outfit)
        if (this.$('head').find('link[href*="Outfit"]').length === 0) {
            this.$('head').append('<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">');
        }

        // Inject Noto Serif SC (for Scene text)
        if (this.$('head').find('link[href*="Noto+Serif+SC"]').length === 0) {
            this.$('head').append('<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600;700&display=swap" rel="stylesheet">');
        }

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

        this.panelManager.ensurePanelInViewport(true);
        this.$(`#${this.config.PANEL_ID}`).css({
            width: `${this.state.panelWidth}px`,
            height: `${this.state.panelHeight}px`,
            top: `${this.state.panelTop}px`,
            left: `${this.state.panelLeft}px`,
            right: 'auto',
        });

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

            // 注入 Lucide 图标到标签导航
            this._injectTabIcons();
            // 更新音频按钮状态
            this.updateAudioToggleIcon();

            this.logger.success('面板 HTML 加载并注入成功。');
            this.applyFontSize();
        } catch (error) {
            this.logger.error('严重: 面板 HTML 加载失败:', error);
        }
    }

    /**
     * 注入 Lucide 图标到标签导航
     */
    _injectTabIcons() {
        const tabIcons = {
            'world-state': Icons.compass,
            'map-nav': Icons.map,
            'settings': Icons.settings
        };
        this.$('.tw-tab-link').each((_, el) => {
            const $tab = this.$(el);
            const tabId = $tab.data('tab');
            const iconSvg = tabIcons[tabId];
            if (iconSvg) {
                $tab.find('.tw-tab-icon').html(`<span class="tw-icon">${iconSvg}</span>`);
            }
        });
    }

    /**
     * 更新音频按钮图标状态
     */
    updateAudioToggleIcon() {
        const $toggle = this.$('#tw-audio-toggle');
        const isEnabled = this.state.isAudioEnabled;
        const iconSvg = isEnabled ? Icons.volume2 : Icons.volumeX;
        $toggle.html(`<span class="tw-icon">${iconSvg}</span>`);
        $toggle.toggleClass('muted', !isEnabled);
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

    _renderWorldStateFallback($wsPane) {
        this.logger.log('无世界状态数据，显示等待信息。');
        this.timeAnimator.stop();
        this.panelThemeManager.weatherSystem.clearAllWeatherEffects(true);
        this.panelThemeManager.applyThemeAndEffects({});
        $wsPane.empty().html('<p class="tw-notice">等待世界状态数据...</p>');
    }

    async updateWorldStatePane() {
        const $wsPane = this.$('#world-state-pane');
        if (!$wsPane.length) return;

        this.timeAnimator.stop();

        if (this.state.latestWorldStateData) {
            this.logger.log('检测到世界状态数据，正在更新世界状态面板...');
            $wsPane.empty();
            this.panelThemeManager.applyThemeAndEffects(this.state.latestWorldStateData);
            this.renderer.renderWorldStatePane($wsPane, this.state.latestWorldStateData);
            if (this.state.latestWorldStateData['时间']) {
                this.timeAnimator.start(this.state.latestWorldStateData['时间']);
            }
            return;
        }

        this._renderWorldStateFallback($wsPane);
    }

    async updateMapPane() {
        const $mapPane = this.$('#map-nav-pane');
        if (!$mapPane.length) return;

        $mapPane.empty();
        await this.renderer.renderMapPane($mapPane);

        if (this.state.mapMode === 'advanced') {
            this.eventManager.mapViewportManager.updateMapOverlays();
        }
    }

    updateSettingsPane() {
        const $settingsPane = this.$('#settings-pane');
        if (!$settingsPane.length) return;

        $settingsPane.empty();
        this.renderer.renderSettingsPane($settingsPane);
    }

    async updateAllPanes() {
        this.logger.log('正在更新所有面板内容...');
        await this.updateWorldStatePane();
        await this.updateMapPane();
        this.updateSettingsPane();
        this.logger.log('所有面板内容更新完成。');
    }
}
