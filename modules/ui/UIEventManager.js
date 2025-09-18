/**
 * The World - UI Event Manager
 * @description Centralizes all UI event bindings for the panel.
 */
export class UIEventManager {
    constructor(dependencies) {
        // Assign all dependencies passed from UIController
        Object.assign(this, dependencies);
        this.longPressTimer = null;
        this.pressStartTime = 0;
    }

    toggleSkygazingMode() {
        this.state.isSkygazingModeActive = !this.state.isSkygazingModeActive;
        this.logger.log(`仰望天空模式切换为: ${this.state.isSkygazingModeActive}`);
        const $body = this.$(this.win.document.body);

        if (this.state.isSkygazingModeActive) {
            // Hide the panel if it's open, to not obstruct the view
            if (this.state.isPanelVisible) {
                this.panelManager.togglePanel(false);
            }

            const css = `
                body.the-world-skygazing-mode > *:not(#the_world-toggle-btn):not(.tw-global-theme-container):not(#the_world-fx-layer):not(#the_world-fx-layer-bg):not(#${this.config.SKYGAZING_STYLE_ID}):not(.ws-dialog-overlay) {
                    transition: opacity 0.5s ease-out;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                /* Explicitly hide some elements that might not be direct children or are important to hide */
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
            .off('.tw_toggle') // Remove all previous tw_toggle namespaced events
            .on('mousedown.tw_toggle touchstart.tw_toggle', (e) => {
                if (e.type === 'mousedown' && e.which !== 1) return; // Ignore non-left clicks

                this.pressStartTime = Date.now();
                
                $toggleBtn.append('<div class="long-press-indicator"></div>');
                setTimeout(() => $toggleBtn.addClass('long-press-active'), 10);

                this.longPressTimer = setTimeout(() => {
                    this.toggleSkygazingMode();
                    this.longPressTimer = null; // Mark as fired
                }, 5000);
            })
            .on('mouseup.tw_toggle touchend.tw_toggle', (e) => {
                if (this.longPressTimer === null) { // Long press already fired
                    clearLongPress();
                    return;
                }

                const pressDuration = Date.now() - this.pressStartTime;
                clearLongPress();
                
                if (pressDuration < 500) { // Click threshold
                     e.stopPropagation();
                     this.panelManager.togglePanel();
                }
            })
            .on('mouseleave.tw_toggle', () => {
                // Cancel if mouse leaves button
                clearLongPress();
            });
        
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
        $panel.on('click.tw_content', '.main_location', (e) => {
            const mapData = this.state.latestMapData;
            if (!mapData || mapData.moveBlock) return;
            const $this = this.$(e.currentTarget);
            this.state.selectedMainLocation = $this.data('name');
            this.state.selectedSubLocation = null;
            $panel.find('.main_location, .sub_location').removeClass('selected');
            $this.addClass('selected');
            $panel.find('.sub_locations_container').hide();
            $panel.find(`.sub_locations_container[data-main="${this.state.selectedMainLocation}"]`).show();
            $panel.find('.go_button').addClass('disabled');
        });
        $panel.on('click.tw_content', '.sub_location', (e) => {
            const mapData = this.state.latestMapData;
            if (!mapData || mapData.moveBlock) return;
            const $this = this.$(e.currentTarget);
            this.state.selectedSubLocation = $this.data('name');
            $panel.find('.sub_location').removeClass('selected');
            $this.addClass('selected');
            $panel.find('.go_button').removeClass('disabled');
        });
        $panel.on('click.tw_content', '.character_name.interactive', (e) => {
            e.stopPropagation();
            this.dialogs.showNpcInteractDialog(this.$(e.target).closest('.character_name').data('name'));
        });
        $panel.on('click.tw_content', '.go_button', () => {
            if (!this.state.selectedMainLocation || !this.state.selectedSubLocation) return;
            const command = `<request:{{user}}前往 ${this.state.selectedMainLocation} 的 ${this.state.selectedSubLocation}>`;
            this.triggerSlash(`/setinput ${command}`);
            this.panelManager.togglePanel(false);
        });

        // Settings Pane
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
                'cloud-fx-toggle': 'isCloudFxEnabled'
            };
            const key = keyMap[e.target.id];
            if (key) {
                this.state[key] = e.target.checked;
                this.dataManager.saveState();

                if (key === 'isGlobalThemeEngineEnabled') {
                    const isEnabled = this.state.isGlobalThemeEngineEnabled;
                    this.$('#immersive-mode-toggle').prop('disabled', !isEnabled);
                    
                    if (isEnabled) {
                        this.globalThemeManager.activate();
                    } else {
                        this.globalThemeManager.deactivate();
                    }
                }
                
                if (key === 'isImmersiveModeEnabled') {
                     if (this.globalThemeManager.isActive) {
                        this.globalThemeManager.updateTheme();
                    }
                }

                // Update panel specific effects
                this.panelThemeManager.applyThemeAndEffects(this.state.latestWorldStateData);
            }
        });
        
        $panel.on('click.tw_settings', '#clear-all-data-btn', () => {
            if (confirm('确定要清空所有存储的数据吗？\n此操作无法撤销！')) {
                this.dataManager.clearAllStorage();
                this.ui.updateAllPanes();
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
    }
}