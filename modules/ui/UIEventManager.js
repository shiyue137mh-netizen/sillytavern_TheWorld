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
        this.isAudioUnlocked = false;

        // State for map interactions
        this.mapState = {
            pan: { x: 0, y: 0 },
            zoom: 1,
            isPanning: false,
            startPos: { x: 0, y: 0 },
            isDraggingPin: false,
            draggedPinGhost: null,
            draggedPinOriginalPos: { left: 0, top: 0},
            isReparenting: false,
            isDraggingUncharted: false,
            draggedUnchartedGhost: null,
            isPlacementMode: false,
        };
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
            .off('.tw_toggle') // Remove all previous tw_toggle namespaced events
            .on('mousedown.tw_toggle touchstart.tw_toggle', (e) => {
                if (!this.isAudioUnlocked) {
                    this.audioManager.unlockAudio();
                    this.isAudioUnlocked = true;
                }
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
        
        $panel.on('click.tw_content', '.character_name.interactive', (e) => {
            e.stopPropagation();
            this.dialogs.showNpcInteractDialog(this.$(e.target).closest('.character_name').data('name'));
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

                if (key === 'isAudioEnabled') {
                    this.audioManager.setMasterEnabled(e.target.checked);
                }

                // Update panel specific effects
                this.panelThemeManager.applyThemeAndEffects(this.state.latestWorldStateData);
            }
        });

        $panel.on('click.tw_settings', '.tw-map-mode-switch button', (e) => {
            const $button = this.$(e.currentTarget);
            const newMode = $button.data('mode');
            if (this.state.mapMode === newMode) return;
        
            this.state.mapMode = newMode;
            // When switching to lite mode, always reset the path to root
            if (newMode === 'lite') {
                this.state.liteMapPathStack = [];
            }
            this.dataManager.saveState();
        
            this.renderer.renderMapPane(this.$('#map-nav-pane'));
            
            // Update the button's active state in settings
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

        $panel.on('change.tw_settings', '#settings-pane input[type="range"]', () => {
            this.dataManager.saveState();
        });

        $panel.on('change.tw_settings', '#font-size-select', (e) => {
            const newSize = this.$(e.target).val();
            this.state.fontSize = newSize;
            this.dataManager.saveState();
            this.$(`#${this.config.PANEL_ID}`).css('--tw-font-size', newSize);
            this.logger.log(`字体大小已更改为: ${newSize}`);
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

        // Map Book Creation
        $body.on('click.tw_map_create', '#tw-create-map-btn, #tw-create-map-placeholder-btn', async (e) => {
            const $button = this.$(e.currentTarget);
            const originalText = $button.html();
            $button.html('正在创建...').prop('disabled', true);
            
            const newBookName = await this.mapSystem.lorebookManager.createAndBindMapWorldbook();
            
            if (newBookName) {
                await this.mapSystem.initializeData(newBookName);
                this.ui.updateAllPanes(); // This re-renders everything
                this.toastr.success(`地图档案 "${newBookName}" 已成功创建并绑定！`, '创建成功');
            } else {
                $button.html(originalText).prop('disabled', false);
                this.toastr.error('创建地图档案失败，请检查浏览器控制台日志。', '创建失败');
            }
        });

        // Map Editor Events (scoped to the map pane)
        $body.on('click.tw_map_editor_setup', '#tw-map-edit-toggle-btn', (e) => this.toggleEditorMode(e));
        
        // This handles general map panning and zooming, which is always active in the map pane.
        $body.on('mousedown.tw_map_pan', '.tw-map-viewport', (e) => this.handleMapPanStart(e));
        $body.on('wheel.tw_map_zoom', '.tw-map-viewport', (e) => this.handleMapZoom(e));

        // Advanced Map Hover Effects (works in both view and edit mode)
        $body.on('mouseenter.tw_map_hover', '#map-nav-pane .tw-map-pin', (e) => {
            if (this.mapState.isDraggingPin) return;

            const $mapPane = this.$('#map-nav-pane');
            const $svg = $mapPane.find('.tw-map-lines-svg');
            if (!$svg.length) return;

            let $hoverLine = $svg.find('#tw-hover-line');
            if (!$hoverLine.length) {
                const line = this.win.document.createElementNS('http://www.w3.org/2000/svg', 'line');
                $hoverLine = this.$(line)
                    .attr('id', 'tw-hover-line')
                    .addClass('tw-map-line-hover');
                $svg.append($hoverLine);
            }

            const $childPin = this.$(e.currentTarget);
            const childId = $childPin.data('node-id');
            const childNode = this.mapSystem.mapDataManager.nodes.get(childId);

            if (childNode && childNode.parentId) {
                const parentNode = this.mapSystem.mapDataManager.nodes.get(childNode.parentId);
                if (parentNode && parentNode.coords) {
                    const $parentPin = $mapPane.find(`.tw-map-pin[data-node-id="${parentNode.id}"]`);
                    if ($parentPin.length) {
                        $hoverLine
                            .attr('x1', $childPin.css('left'))
                            .attr('y1', $childPin.css('top'))
                            .attr('x2', $parentPin.css('left'))
                            .attr('y2', $parentPin.css('top'))
                            .css('opacity', 1);
                    }
                }
            }
        });

        $body.on('mouseleave.tw_map_hover', '#map-nav-pane .tw-map-pin', (e) => {
            const $mapPane = this.$('#map-nav-pane');
            const $hoverLine = $mapPane.find('#tw-hover-line');
            if ($hoverLine.length) {
                $hoverLine.css('opacity', 0);
            }
        });

        // NEW: Illustration Hover Card
        $body.on('mouseenter.tw_map_illustration', '#map-nav-pane .tw-map-pin', (e) => {
            const $pin = this.$(e.currentTarget);
            const nodeId = $pin.data('node-id');
            const node = this.mapSystem.mapDataManager.nodes.get(nodeId);

            if (node && node.illustration) {
                // Remove any old card
                this.$('.tw-map-hover-card').remove();

                const imageUrl = `${this.config.IMAGE_BASE_URL}${node.illustration}`;
                const $card = this.$('<div class="tw-map-hover-card"></div>');
                const $img = this.$('<img>').attr('src', imageUrl);

                $card.append($img);
                this.$('body').append($card);

                const positionCard = () => {
                    const cardWidth = $card.outerWidth();
                    const cardHeight = $card.outerHeight();
                    const winWidth = this.win.innerWidth;
                    const winHeight = this.win.innerHeight;
                    const offset = 20;

                    let top = e.clientY + offset;
                    let left = e.clientX + offset;

                    if (left + cardWidth > winWidth) {
                        left = e.clientX - cardWidth - offset;
                    }
                    if (top + cardHeight > winHeight) {
                        top = e.clientY - cardHeight - offset;
                    }

                    $card.css({ top: `${top}px`, left: `${left}px` });
                    requestAnimationFrame(() => {
                        $card.addClass('visible');
                    });
                };

                // Position after image loads to get correct dimensions
                $img.on('load', positionCard).on('error', () => $card.remove());
                // Also position right away in case image is cached
                if ($img[0].complete) {
                    positionCard();
                }
            }
        });

        $body.on('mouseleave.tw_map_illustration', '#map-nav-pane .tw-map-pin', (e) => {
            const $card = this.$('.tw-map-hover-card');
            if ($card.length) {
                $card.removeClass('visible');
                setTimeout(() => {
                    $card.remove();
                }, 300); // Match CSS transition duration
            }
        });


        // Lite Map Navigation Events
        $body.on('click.tw_map_nav_lite', '#map-nav-pane .tw-lite-map-item', (e) => {
            const nodeId = this.$(e.currentTarget).data('node-id');
            if (this.renderer._nodeHasChildren(nodeId)) {
                this.state.liteMapPathStack.push(nodeId);
                this.renderer.renderMapPane(this.$('#map-nav-pane'));
            }
        });
        $body.on('click.tw_map_nav_lite', '#map-nav-pane .tw-lite-map-breadcrumb-item[data-index]', (e) => {
            const index = parseInt(this.$(e.currentTarget).data('index'), 10);
            this.state.liteMapPathStack = this.state.liteMapPathStack.slice(0, index + 1);
            this.renderer.renderMapPane(this.$('#map-nav-pane'));
        });
        $body.on('click.tw_map_nav_lite', '#map-nav-pane .tw-lite-map-breadcrumb-item-root', () => {
            this.state.liteMapPathStack = [];
            this.renderer.renderMapPane(this.$('#map-nav-pane'));
        });
    }
    
    bindWindowEvents() {
        // Use debounce to prevent excessive calls on resize
        let resizeTimeout;
        this.win.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.ui.handleResize(), 150);
        });
        
        const $winDoc = this.$(this.win.document);
        $winDoc.on('mouseup.tw_map_global_end touchend.tw_map_global_end', (e) => {
            if (this.mapState.isPanning) this.handleMapPanEnd(e);
            if (this.mapState.isDraggingPin) this.handlePinDragEnd(e);
            if (this.mapState.isDraggingUncharted) this.handleUnchartedDragEnd(e);
        });
        
        $winDoc.on('mousemove.tw_map_global_move touchmove.tw_map_global_move', (e) => {
            if (this.mapState.isPanning) this.handleMapPanMove(e);
            if (this.mapState.isDraggingPin) this.handlePinDragMove(e);
            if (this.mapState.isDraggingUncharted) this.handleUnchartedDragMove(e);
        });

        $winDoc.on('keydown.tw_map_global_key', (e) => {
            if (e.key === 'Escape' && this.mapState.isPlacementMode) {
                this.exitPlacementMode();
            }
        });
    }

    // Map Pan & Zoom Handlers
    applyMapTransform() {
        const $viewport = this.$('.tw-map-viewport');
        if (!$viewport.length) return;
    
        const { pan, zoom } = this.mapState;
    
        // Apply transform to canvas and SVG layers
        $viewport.find('.tw-map-canvas, .tw-map-lines-svg').css('transform', `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`);
    
        // Dynamically update the viewport's grid background to match pan and zoom
        const grid_size = 25 * zoom;
        const bg_position = `${pan.x}px ${pan.y}px`;
    
        $viewport.css({
            'background-size': `${grid_size}px ${grid_size}px`,
            'background-position': bg_position
        });
    }

    _getEventCoords(e) {
        return e.type.startsWith('touch') ? e.originalEvent.touches[0] || e.originalEvent.changedTouches[0] : e;
    }

    handleMapPanStart(e) {
        if (this.$(e.target).closest('.tw-map-pin, .tw-map-sidebar, .tw-map-editor-toolbox').length > 0 || this.mapState.isPlacementMode) return;
        e.preventDefault();
        this.mapState.isPanning = true;
        const coords = this._getEventCoords(e);
        this.mapState.startPos = { x: coords.clientX - this.mapState.pan.x, y: coords.clientY - this.mapState.pan.y };
        this.$(e.currentTarget).css('cursor', 'grabbing');
    }

    handleMapPanMove(e) {
        if (!this.mapState.isPanning) return;
        const coords = this._getEventCoords(e);
        this.mapState.pan.x = coords.clientX - this.mapState.startPos.x;
        this.mapState.pan.y = coords.clientY - this.mapState.startPos.y;
        this.applyMapTransform();
    }

    handleMapPanEnd(e) {
        this.mapState.isPanning = false;
        this.$('.tw-map-viewport').css('cursor', 'grab');
    }

    handleMapZoom(e) {
        e.preventDefault();
        const $viewport = this.$(e.currentTarget);
        const delta = e.originalEvent.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.2, Math.min(5, this.mapState.zoom + delta));
        
        const rect = $viewport[0].getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldX = (mouseX - this.mapState.pan.x) / this.mapState.zoom;
        const worldY = (mouseY - this.mapState.pan.y) / this.mapState.zoom;
        
        this.mapState.pan.x = mouseX - worldX * newZoom;
        this.mapState.pan.y = mouseY - worldY * newZoom;
        this.mapState.zoom = newZoom;
        
        this.applyMapTransform();
    }
    
    // Editor Mode Handlers
    toggleEditorMode(e) {
        const $button = this.$(e.currentTarget);
        const $mapPane = this.$('#map-nav-pane');
        
        const isActive = !$mapPane.hasClass('editor-mode-active');
        $mapPane.toggleClass('editor-mode-active', isActive);
        $button.toggleClass('active', isActive);

        if (isActive) {
            this.logger.log('[Map Editor] Editor mode ACTIVATED');
            $button.text('完成编辑 ✅');
            this.dialogs.showMapEditorToolbox($mapPane);
            this.bindMapEditorEvents($mapPane);
        } else {
            this.logger.log('[Map Editor] Editor mode DEACTIVATED');
            $button.text('编辑地图 ✏️');
            this.exitPlacementMode(); // Ensure placement mode is off
            this.dialogs.hideMapEditorToolbox();
            this.unbindMapEditorEvents($mapPane);
            this.$('.tw-map-pin.selected').removeClass('selected');
        }
    }

    bindMapEditorEvents($mapPane) {
        // New node creation flow
        $mapPane.on('click.tw_map_editor', '#tw-create-node-btn', () => this.enterPlacementMode());
        
        // Node selection and dragging
        $mapPane.on('click.tw_map_editor', '.tw-map-pin', (e) => this.handlePinClick(e));
        $mapPane.on('mousedown.tw_map_editor_pin', '.tw-map-pin', (e) => this.handlePinDragStart(e));
        $mapPane.on('mousedown.tw_map_editor_uncharted', '.tw-sidebar-item', (e) => this.handleUnchartedDragStart(e));

        // Toolbox interactions
        $mapPane.on('click.tw_map_editor', '.tw-map-node-tree-item', (e) => this.handleNodeListClick(e));
        this.bindToolboxEditorEvents($mapPane);
    }
    
    unbindMapEditorEvents($mapPane) {
        $mapPane.off('.tw_map_editor .tw_map_editor_pin .tw_map_editor_uncharted');
    }

    // --- New Editor Workflow ---

    enterPlacementMode() {
        if (this.mapState.isPlacementMode) return;
        this.mapState.isPlacementMode = true;
        
        const $viewport = this.$('.tw-map-viewport');
        const $button = this.$('#tw-create-node-btn');
        
        $viewport.addClass('placement-mode');
        $button.addClass('placement-active').text('在地图上单击以放置节点...');

        $viewport.one('click.tw_placement', (e) => this.handlePlacementClick(e));
    }

    exitPlacementMode() {
        if (!this.mapState.isPlacementMode) return;
        this.mapState.isPlacementMode = false;
        
        const $viewport = this.$('.tw-map-viewport');
        const $button = this.$('#tw-create-node-btn');
        
        $viewport.removeClass('placement-mode');
        $button.removeClass('placement-active').text('+ 创建新节点');
        $viewport.off('click.tw_placement');
    }

    async handlePlacementClick(e) {
        if (this.$(e.target).closest('.tw-map-pin, .tw-map-sidebar').length > 0) {
            this.exitPlacementMode();
            return;
        }

        const $canvas = this.$('.tw-map-canvas');
        const viewportRect = e.currentTarget.getBoundingClientRect();
        
        const canvasX = (e.clientX - viewportRect.left - this.mapState.pan.x) / this.mapState.zoom;
        const canvasY = (e.clientY - viewportRect.top - this.mapState.pan.y) / this.mapState.zoom;
        
        const mapX = Math.round((canvasX / $canvas.width()) * 10000);
        const mapY = Math.round((canvasY / $canvas.height()) * 10000);

        // Exit placement mode immediately
        this.exitPlacementMode();

        const id = prompt("输入新地点的唯一ID (例如: 'stormwind_keep'):");
        if (!id) return;
        if (this.mapSystem.mapDataManager.nodes.has(id)) {
            alert("错误: 该ID已存在。");
            return;
        }
        const name = prompt("输入新地点的名称 (例如: '暴风城要塞'):", "新地点");
        if (!name) return;

        const newNode = { op: 'add_or_update', id: id, name: name, coords: `${mapX / 10},${mapY / 10}` };
        await this.mapSystem.mapDataManager.processMapUpdate([newNode]);
        
        // Refresh UI
        this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
        this.renderer.renderMapPane(this.$('#map-nav-pane'));
        await this.mapSystem.atlasManager.updateAtlas();
    }

    handlePinClick(e) {
        e.stopPropagation();
        this.selectNode(this.$(e.currentTarget).data('node-id'));
    }

    handleNodeListClick(e) {
        this.selectNode(this.$(e.currentTarget).data('node-id'));
    }

    selectNode(nodeId) {
        // Deselect previous
        this.$('.tw-map-pin.selected').removeClass('selected');
        this.$('.tw-map-node-tree-item.selected').removeClass('selected');
        
        // Select new
        this.$(`.tw-map-pin[data-node-id="${nodeId}"]`).addClass('selected');
        this.$(`.tw-map-node-tree-item[data-node-id="${nodeId}"]`).addClass('selected');
        
        this.dialogs.populateToolboxEditor(nodeId);
    }
    
    bindToolboxEditorEvents($container) {
        const saveNode = async (isNameChange = false) => {
            const $editor = this.$('.tw-map-node-editor');
            const nodeId = $editor.data('current-node-id');
            if (!nodeId) return;

            const updates = {};
            $editor.find('[data-prop]').each((_, el) => {
                const $el = this.$(el);
                updates[$el.data('prop')] = $el.val();
            });
            
            if (updates.parentId === '') updates.parentId = undefined;
            
            await this.mapSystem.mapDataManager.updateNodeDetail(nodeId, updates);
            
            // Refresh UI
            this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
            this.renderer.renderMapPane(this.$('#map-nav-pane'));
            await this.mapSystem.atlasManager.updateAtlas();
        };

        $container.on('change.tw_map_editor', '.tw-map-node-editor [data-prop]', (e) => saveNode());

        $container.on('click.tw_map_editor', '.tw-clear-coords-btn', async (e) => {
            e.preventDefault();
            const $editor = this.$('.tw-map-node-editor');
            const nodeId = $editor.data('current-node-id');
            if (!nodeId) return;
        
            if (confirm(`确定要清除节点 "${nodeId}" 的坐标吗？\n该节点将变为“孤立节点”。`)) {
                await this.mapSystem.mapDataManager.updateNodeDetail(nodeId, { coords: undefined });
                
                // Refresh UI
                $editor.find('#node-coords').val('');
                await this.mapSystem.atlasManager.updateAtlas();
                this.renderer.renderMapPane(this.$('#map-nav-pane'));
                this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
            }
        });

        $container.on('click.tw_map_editor', '.tw-delete-node-btn', async () => {
             const $editor = this.$('.tw-map-node-editor');
             const nodeId = $editor.data('current-node-id');
             const node = this.mapSystem.mapDataManager.nodes.get(nodeId);
             if (!node) return;

             if (confirm(`确定要删除节点 "${node.name}" (${node.id}) 吗？\n此操作无法撤销！`)) {
                 this.dialogs.populateToolboxEditor(null); // Hide editor
                 await this.mapSystem.mapDataManager.processMapUpdate([{ op: 'remove', id: nodeId }]);
                 
                 // Refresh UI
                 this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
                 this.renderer.renderMapPane(this.$('#map-nav-pane'));
                 await this.mapSystem.atlasManager.updateAtlas();
             }
        });
    }

    handlePinDragStart(e) {
        if (e.which !== 1) return;
        e.preventDefault();
        e.stopPropagation();
        
        this.mapState.isDraggingPin = true;
        this.mapState.isReparenting = e.altKey;
        
        const $draggedPin = this.$(e.currentTarget);
        this.mapState.draggedPinGhost = this.$('<div>')
            .addClass('tw-map-pin-ghost')
            .attr('data-node-id', $draggedPin.data('node-id'))
            .appendTo('body');
        
        this.handlePinDragMove(e);
    }

    handlePinDragMove(e) {
        if (!this.mapState.isDraggingPin) return;
        e.preventDefault();
        const coords = this._getEventCoords(e);
        this.mapState.draggedPinGhost.css({ left: coords.clientX, top: coords.clientY });

        if (this.mapState.isReparenting) {
            this.$('.tw-map-pin').removeClass('reparent-target');
            const targetElement = this.$(this.win.document.elementFromPoint(coords.clientX, coords.clientY));
            const targetPin = targetElement.closest('.tw-map-pin');
            if (targetPin.length && targetPin.data('node-id') !== this.mapState.draggedPinGhost.data('node-id')) {
                targetPin.addClass('reparent-target');
            }
        }
    }

    async handlePinDragEnd(e) {
        const { draggedPinGhost } = this.mapState;
        if (!draggedPinGhost) return;

        const nodeId = draggedPinGhost.data('node-id');
        const coords = this._getEventCoords(e);

        if (this.mapState.isReparenting) {
            const targetElement = this.$(this.win.document.elementFromPoint(coords.clientX, coords.clientY));
            const targetPin = targetElement.closest('.tw-map-pin.reparent-target');
            if (targetPin.length && targetPin.data('node-id') !== nodeId) {
                const targetNodeId = targetPin.data('node-id');
                await this.mapSystem.mapDataManager.updateNodeDetail(nodeId, { parentId: targetNodeId });
                this.logger.log(`[Map Editor] Reparented ${nodeId} to ${targetNodeId}`);
            }
        } else {
            const $viewport = this.$('.tw-map-viewport');
            const viewportRect = $viewport[0].getBoundingClientRect();
            const canvasX = (coords.clientX - viewportRect.left - this.mapState.pan.x) / this.mapState.zoom;
            const canvasY = (coords.clientY - viewportRect.top - this.mapState.pan.y) / this.mapState.zoom;
            
            const $canvas = this.$('.tw-map-canvas');
            const mapX = Math.round((canvasX / $canvas.width()) * 10000);
            const mapY = Math.round((canvasY / $canvas.height()) * 10000);
            
            await this.mapSystem.mapDataManager.updateNodeDetail(nodeId, { coords: `${mapX/10},${mapY/10}` });
            this.logger.log(`[Map Editor] Moved ${nodeId} to ${mapX/10},${mapY/10}`);
        }
        
        // Cleanup
        draggedPinGhost.remove();
        this.$('.tw-map-pin.reparent-target').removeClass('reparent-target');
        this.mapState.isDraggingPin = false;
        this.mapState.isReparenting = false;
        this.mapState.draggedPinGhost = null;

        await this.mapSystem.atlasManager.updateAtlas();
        this.renderer.renderMapPane(this.$('#map-nav-pane'));
        this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
    }

    handleUnchartedDragStart(e) {
        if (e.which !== 1) return;
        e.preventDefault();
        e.stopPropagation();
    
        this.mapState.isDraggingUncharted = true;
        const $draggedItem = this.$(e.currentTarget);
        const nodeId = $draggedItem.data('node-id');
        const nodeName = $draggedItem.text();
    
        this.mapState.draggedUnchartedGhost = this.$('<div>')
            .addClass('tw-uncharted-ghost')
            .attr('data-node-id', nodeId)
            .text(nodeName)
            .appendTo('body');
    
        this.handleUnchartedDragMove(e);
    }
    
    handleUnchartedDragMove(e) {
        if (!this.mapState.isDraggingUncharted) return;
        e.preventDefault();
        const coords = this._getEventCoords(e);
        this.mapState.draggedUnchartedGhost.css({ left: coords.clientX, top: coords.clientY });
    }
    
    async handleUnchartedDragEnd(e) {
        const { draggedUnchartedGhost } = this.mapState;
        if (!draggedUnchartedGhost) return;
    
        const nodeId = draggedUnchartedGhost.data('node-id');
        const coords = this._getEventCoords(e);
    
        const $viewport = this.$('.tw-map-viewport');
        if ($viewport.length === 0) { // Dropped outside the map
            draggedUnchartedGhost.remove();
            this.mapState.draggedUnchartedGhost = null;
            this.mapState.isDraggingUncharted = false;
            return;
        }

        const viewportRect = $viewport[0].getBoundingClientRect();
    
        // Check if dropped inside the viewport
        if (coords.clientX >= viewportRect.left && coords.clientX <= viewportRect.right &&
            coords.clientY >= viewportRect.top && coords.clientY <= viewportRect.bottom) {
    
            const canvasX = (coords.clientX - viewportRect.left - this.mapState.pan.x) / this.mapState.zoom;
            const canvasY = (coords.clientY - viewportRect.top - this.mapState.pan.y) / this.mapState.zoom;
            
            const $canvas = this.$('.tw-map-canvas');
            const mapX = Math.round((canvasX / $canvas.width()) * 10000);
            const mapY = Math.round((canvasY / $canvas.height()) * 10000);
    
            await this.mapSystem.mapDataManager.updateNodeDetail(nodeId, { coords: `${mapX/10},${mapY/10}` });
            this.logger.log(`[Map Editor] Plotted uncharted node ${nodeId} to ${mapX/10},${mapY/10}`);
    
            // Full UI Refresh
            await this.mapSystem.atlasManager.updateAtlas();
            this.renderer.renderMapPane(this.$('#map-nav-pane'));
            this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
        }
    
        // Cleanup
        draggedUnchartedGhost.remove();
        this.mapState.draggedUnchartedGhost = null;
        this.mapState.isDraggingUncharted = false;
    }
}