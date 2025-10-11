/**
 * The World - UI Event Manager
 * @description Centralizes all UI event bindings for the panel.
 * V2: Refactored to delegate map and editor interactions to specialized managers.
 */
import { MapViewportManager } from './MapViewportManager.js';
import { MapEditorManager } from './MapEditorManager.js';

export class UIEventManager {
    constructor(dependencies) {
        Object.assign(this, dependencies);
        this.longPressTimer = null;
        this.pressStartTime = 0;
        this.isAudioUnlocked = false;

        // Instantiate specialized managers
        this.mapViewportManager = new MapViewportManager(dependencies);
        this.mapEditorManager = new MapEditorManager({ 
            ...dependencies, 
            viewportManager: this.mapViewportManager 
        });
    }

    toggleSkygazingMode() {
        this.state.isSkygazingModeActive = !this.state.isSkygazingModeActive;
        this.logger.log(`仰望天空模式切换为: ${this.state.isSkygazingModeActive}`);
        const $body = this.$(this.win.document.body);

        if (this.state.isSkygazingModeActive) {
            if (this.state.isPanelVisible) {
                this.panelManager.togglePanel(false);
            }
            const css = `
                body.the-world-skygazing-mode > *:not(#the_world-toggle-btn):not(.tw-global-theme-container):not(#the_world-fx-layer):not(#the_world-fx-layer-bg):not(#${this.config.SKYGAZING_STYLE_ID}):not(.ws-dialog-overlay) {
                    transition: opacity 0.5s ease-out;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                body.the-world-skygazing-mode #the_world-panel,
                body.the-world-skygazing-mode .modal,
                body.the-world-skygazing-mode .ws-dialog-overlay {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                body.the-world-skygazing-mode #the_world-toggle-btn {
                    z-index: 10001 !important;
                }
            `;
            this.injectionEngine.injectCss(this.config.SKYGAZING_STYLE_ID, css);
            $body.addClass('the-world-skygazing-mode');
        } else {
            this.injectionEngine.removeCss(this.config.SKYGAZING_STYLE_ID);
            $body.removeClass('the-world-skygazing-mode');
        }
    }

    bindAllEvents() {
        this.bindWindowEvents();
        this.logger.log('正在绑定所有UI事件...');
        const $body = this.$('body');
        const $panel = this.$(`#${this.config.PANEL_ID}`);
        
        // Toggle Button - with long press for Skygazing and short press for panel toggle
        const $toggleBtn = this.$(`#${this.config.TOGGLE_BUTTON_ID}`);
        const clearLongPress = () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            $toggleBtn.removeClass('long-press-active');
            $toggleBtn.find('.long-press-indicator').remove();
        };

        $toggleBtn
            .off('.tw_toggle')
            .on('mousedown.tw_toggle touchstart.tw_toggle', (e) => {
                if (!this.isAudioUnlocked) {
                    this.audioManager.unlockAudio();
                    this.isAudioUnlocked = true;
                }
                if (e.type === 'mousedown' && e.which !== 1) return;

                this.pressStartTime = Date.now();
                $toggleBtn.append('<div class="long-press-indicator"></div>');
                setTimeout(() => $toggleBtn.addClass('long-press-active'), 10);
                this.longPressTimer = setTimeout(() => {
                    this.toggleSkygazingMode();
                    this.longPressTimer = null;
                }, 5000);
            })
            .on('mouseup.tw_toggle touchend.tw_toggle', (e) => {
                if (this.longPressTimer === null) {
                    clearLongPress();
                    return;
                }
                const pressDuration = Date.now() - this.pressStartTime;
                clearLongPress();
                if (pressDuration < 500) {
                     this.panelManager.togglePanel();
                }
            })
            .on('mouseleave.tw_toggle', clearLongPress);
        
        this.panelManager.makeDraggable($toggleBtn, $toggleBtn, true);

        // Panel Interactions
        this.panelManager.makeDraggable($panel, $panel.find(`.${this.config.HEADER_CLASS}`));
        this.panelManager.makeResizable($panel, $panel.find('.tw-resize-handle'));
        $panel.on('click.tw_panel', '.tw-close', () => this.panelManager.togglePanel(false));
        
        // Tabs
        $body.on('click.tw_tabs', `#${this.config.PANEL_ID} .tw-tab-link`, (e) => {
            const $this = this.$(e.currentTarget);
            if ($this.hasClass('active')) return;
            const tabId = $this.data('tab');
            $panel.find('.tw-tab-link, .tw-pane').removeClass('active');
            $this.addClass('active');
            this.$(`#${tabId}-pane`).addClass('active');
        });

        // Pane Content Interactions
        $panel.on('click.tw_content', '.ws-interactive-keyword', (e) => this.dialogs.showKeywordInteractDialog(this.$(e.target).data('keyword')));
        $panel.on('click.tw_content', '.ws-time-interact', () => this.dialogs.showTimeInteractDialog());
        $panel.on('click.tw_content', '.ws-weather-interact', () => this.dialogs.showWeatherInteractDialog());
        $panel.on('click.tw_content', '.character_name.interactive', (e) => {
            e.stopPropagation();
            this.dialogs.showNpcInteractDialog(this.$(e.target).closest('.character_name').data('name'));
        });

        // Settings Pane
        this.bindSettingsEvents($panel);

        // Ripple Effect
        $body.on('click.tw_ripple', '.has-ripple', (e) => {
            const $this = this.$(e.currentTarget);
            $this.find('.ripple').remove();
            const $ripple = this.$('<span class="ripple"></span>');
            const rect = e.currentTarget.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            $ripple.css({ width: size + 'px', height: size + 'px', top: y + 'px', left: x + 'px' });
            $this.append($ripple);
            setTimeout(() => { $ripple.remove(); }, 600);
        });

        // Map Book Creation
        $body.on('click.tw_map_create', '#tw-create-map-btn, #tw-create-map-placeholder-btn', async (e) => {
            const $button = this.$(e.currentTarget);
            const originalText = $button.html();
            $button.html('正在创建...').prop('disabled', true);
            const newBookName = await this.mapSystem.lorebookManager.createAndBindMapWorldbook();
            if (newBookName) {
                await this.mapSystem.initializeData(newBookName);
                await this.ui.updateAllPanes();
                this.toastr.success(`地图档案 "${newBookName}" 已成功创建并绑定！`, '创建成功');
            } else {
                $button.html(originalText).prop('disabled', false);
                this.toastr.error('创建地图档案失败，请检查浏览器控制台日志。', '创建失败');
            }
        });

        // Delegate map-specific events to the managers
        this.mapViewportManager.bindEvents();
        this.mapEditorManager.bindEvents();
        
        // Advanced Map Click Handlers (Non-Editor Mode)
        this.bindAdvancedMapInteractionEvents($body);
        
        // Lite Map Navigation Events
        this.bindLiteMapNavEvents($body);
    }

    bindSettingsEvents($panel) {
        $panel.on('click.tw_settings', '.btn-activate', async (e) => {
            const $button = this.$(e.currentTarget);
            if ($button.text() === '当前') return;
            const themeId = $button.closest('.theme-card').data('theme-id');
            await this.skyThemeController.applyTheme(themeId);
            this.renderer.renderSettingsPane(this.$('#settings-pane'));
        });
        
        $panel.on('click.tw_settings', '.btn-preview', (e) => {
            const themeId = this.$(e.currentTarget).closest('.theme-card').data('theme-id');
            this.dialogs.showThemePreviewDialog(themeId);
        });

        $panel.on('change.tw_settings', '#settings-pane input[type="checkbox"]', (e) => {
            const keyMap = {
                'global-theme-toggle': 'isGlobalThemeEngineEnabled',
                'immersive-mode-toggle': 'isImmersiveModeEnabled',
                'fx-global-toggle': 'isFxGlobal',
                'raindrop-fx-toggle': 'isRaindropFxOn',
                'weather-fx-toggle': 'weatherFxEnabled',
                'cloud-fx-toggle': 'isCloudFxEnabled',
                'audio-enabled-toggle': 'isAudioEnabled'
            };
            const key = keyMap[e.target.id];
            if (key) {
                this.state[key] = e.target.checked;
                this.dataManager.saveState();

                if (key === 'isGlobalThemeEngineEnabled') {
                    const isEnabled = this.state.isGlobalThemeEngineEnabled;
                    this.$('#immersive-mode-toggle').prop('disabled', !isEnabled);
                    isEnabled ? this.globalThemeManager.activate() : this.globalThemeManager.deactivate();
                } else if (key === 'isImmersiveModeEnabled' && this.globalThemeManager.isActive) {
                    this.globalThemeManager.updateTheme();
                } else if (key === 'isAudioEnabled') {
                    this.audioManager.setMasterEnabled(e.target.checked);
                } else {
                    this.panelThemeManager.applyThemeAndEffects(this.state.latestWorldStateData);
                }
            }
        });

        $panel.on('click.tw_settings', '.tw-map-mode-switch button', async (e) => {
            const $button = this.$(e.currentTarget);
            const newMode = $button.data('mode');
            if (this.state.mapMode === newMode) return;
        
            this.state.mapMode = newMode;
            this.state.liteMapPathStack = [];
            this.state.advancedMapPathStack = [];
            this.dataManager.saveState();
            await this.renderer.renderMapPane(this.$('#map-nav-pane'));
            $button.addClass('active').siblings().removeClass('active');
        });
        
        $panel.on('input.tw_settings', '#settings-pane input[type="range"]', (e) => {
            const value = parseFloat(e.target.value);
            const id = e.target.id;
        
            if (id === 'ambient-volume-slider') {
                this.state.ambientVolume = value;
                this.audioManager.setAmbientVolume(value);
                this.$('#ambient-volume-value').text(`${Math.round(value * 100)}%`);
            } else if (id === 'sfx-volume-slider') {
                this.state.sfxVolume = value;
                this.audioManager.setSfxVolume(value);
                this.$('#sfx-volume-value').text(`${Math.round(value * 100)}%`);
            }
        });

        $panel.on('change.tw_settings', '#settings-pane input[type="range"]', () => this.dataManager.saveState());
        $panel.on('change.tw_settings', '#font-size-select', (e) => {
            const newSize = this.$(e.target).val();
            this.state.fontSize = newSize;
            this.dataManager.saveState();
            this.$(`#${this.config.PANEL_ID}`).css('--tw-font-size', newSize);
            this.logger.log(`字体大小已更改为: ${newSize}`);
        });

        $panel.on('click.tw_settings', '#clear-all-data-btn', async () => {
            if (confirm('确定要清空所有存储的数据吗？\n此操作无法撤销！')) {
                this.dataManager.clearAllStorage();
                await this.ui.updateAllPanes();
            }
        });
        $panel.on('click.tw_settings', '#reset-ui-btn', () => {
            const defaultWidth = 450;
            const defaultHeight = this.win.innerHeight * 0.6;
            const defaultTop = 60;
            const defaultLeft = this.win.innerWidth - defaultWidth - 10;
            $panel.css({ width: defaultWidth + 'px', height: defaultHeight + 'px', top: defaultTop + 'px', left: defaultLeft + 'px', }).removeClass('minimized');
            this.state.panelWidth = defaultWidth;
            this.state.panelHeight = defaultHeight;
            this.state.panelTop = defaultTop;
            this.state.panelLeft = defaultLeft;
            this.dataManager.saveState();
            this.panelManager.checkPanelWidth();
        });
    }

    bindAdvancedMapInteractionEvents($body) {
        $body.on('click.tw_map_recenter', '#tw-map-recenter-btn', () => {
            if (this.state.currentPlayerLocationId) {
                this.mapViewportManager.recenterOnNode(this.state.currentPlayerLocationId);
            } else {
                this.toastr.info('玩家当前位置未知，已重置视图。');
                this.mapViewportManager.resetView();
            }
        });

        $body.on('click.tw_map_fit_bounds', '#tw-map-fit-bounds-btn', () => {
            this.mapViewportManager.fitToBounds();
        });
        
        $body.on('click.tw_map_pin_action', '#map-nav-pane .tw-map-pin', async (e) => {
            if (this.mapEditorManager.isEditorActive()) return;
            e.stopPropagation();
            const nodeId = this.$(e.currentTarget).data('node-id');
            const node = this.mapSystem.mapDataManager.nodes.get(nodeId);
            if (!node) return;
            this.dialogs.showNodeInteractionDialog(node, e);
        });

        $body.on('click.tw_map_nav_adv', '#map-nav-pane .tw-adv-map-breadcrumb-item[data-index]', async (e) => {
            const index = parseInt(this.$(e.currentTarget).data('index'), 10);
            this.state.advancedMapPathStack = this.state.advancedMapPathStack.slice(0, index + 1);
            await this.renderer.renderMapPane(this.$('#map-nav-pane'));
        });
        $body.on('click.tw_map_nav_adv', '#map-nav-pane .tw-adv-map-breadcrumb-item-root', async () => {
            this.state.advancedMapPathStack = [];
            await this.renderer.renderMapPane(this.$('#map-nav-pane'));
        });
    }

    bindLiteMapNavEvents($body) {
        $body.on('click.tw_map_nav_lite', '#map-nav-pane .tw-lite-map-item', async (e) => {
            const nodeId = this.$(e.currentTarget).data('node-id');
            const node = this.mapSystem.mapDataManager.nodes.get(nodeId);
            if (!node) return;
        
            if (this.renderer._nodeHasChildren(nodeId)) {
                this.state.liteMapPathStack.push(nodeId);
                await this.renderer.renderMapPane(this.$('#map-nav-pane'));
            } else {
                const command = `/send {{user}}试图移动到 ${node.name} | /trigger`;
                this.triggerSlash(command);
                this.toastr.info(`正在尝试移动到: ${node.name}`);
            }
        });
        
        $body.on('click.tw_map_nav_lite', '#map-nav-pane .tw-lite-map-breadcrumb-item[data-index]', async (e) => {
            const index = parseInt(this.$(e.currentTarget).data('index'), 10);
            this.state.liteMapPathStack = this.state.liteMapPathStack.slice(0, index + 1);
            await this.renderer.renderMapPane(this.$('#map-nav-pane'));
        });
        $body.on('click.tw_map_nav_lite', '#map-nav-pane .tw-lite-map-breadcrumb-item-root', async () => {
            this.state.liteMapPathStack = [];
            await this.renderer.renderMapPane(this.$('#map-nav-pane'));
        });
    }
    
    bindWindowEvents() {
        let resizeTimeout;
        this.win.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.ui.handleResize(), 150);
        });
        
        const $winDoc = this.$(this.win.document);
        $winDoc.on('mouseup.tw_map_global_end touchend.tw_map_global_end', (e) => {
            this.mapViewportManager.handleMapPanEnd(e);
            this.mapEditorManager.handleDragEnd(e);
        });
        
        $winDoc.on('mousemove.tw_map_global_move touchmove.tw_map_global_move', (e) => {
            this.mapViewportManager.handleMapPanMove(e);
            this.mapEditorManager.handleDragMove(e);
        });

        $winDoc.on('keydown.tw_map_global_key', (e) => {
            if (e.key === 'Escape') {
                this.mapEditorManager.handleEscapeKey();
            }
        });
    }
}
