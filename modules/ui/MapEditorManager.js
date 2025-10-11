/**
 * The World - Map Editor Manager
 * @description Manages all map editor interactions and state.
 */
export class MapEditorManager {
    constructor(dependencies) {
        Object.assign(this, dependencies);
        this.editorState = {
            isDraggingPin: false,
            draggedPinGhost: null,
            draggedPinOriginalPos: { left: 0, top: 0 },
            isReparenting: false,
            isDraggingUncharted: false,
            draggedUnchartedGhost: null,
            isPlacementMode: false,
        };
    }

    isEditorActive() {
        return this.$('#map-nav-pane').hasClass('editor-mode-active');
    }

    bindEvents() {
        const $body = this.$('body');
        $body.on('click.tw_map_editor_setup', '#tw-map-edit-toggle-btn', (e) => this.toggleEditorMode(e));

        // Advanced Map Hover Effects (works in both view and edit mode)
        $body.on('mouseenter.tw_map_hover', '#map-nav-pane .tw-map-pin', (e) => {
            if (this.editorState.isDraggingPin) return;

            const $svg = this.$('#map-nav-pane .tw-map-lines-svg');
            if (!$svg.length) return;

            let $hoverLine = $svg.find('#tw-hover-line');
            if (!$hoverLine.length) {
                const line = this.win.document.createElementNS('http://www.w3.org/2000/svg', 'line');
                $hoverLine = this.$(line).attr('id', 'tw-hover-line').addClass('tw-map-line-hover');
                $svg.append($hoverLine);
            }

            const $childPin = this.$(e.currentTarget);
            const childNode = this.mapSystem.mapDataManager.nodes.get($childPin.data('node-id'));

            if (childNode && childNode.parentId) {
                const parentNode = this.mapSystem.mapDataManager.nodes.get(childNode.parentId);
                if (parentNode && parentNode.coords) {
                    const $parentPin = this.$(`.tw-map-pin[data-node-id="${parentNode.id}"]`);
                    if ($parentPin.length) {
                        $hoverLine.attr({ x1: $childPin.css('left'), y1: $childPin.css('top'), x2: $parentPin.css('left'), y2: $parentPin.css('top') }).css('opacity', 1);
                    }
                }
            }
        });

        $body.on('mouseleave.tw_map_hover', '#map-nav-pane .tw-map-pin', () => this.$('#tw-hover-line').css('opacity', 0));
        
        // Illustration & Description Hover Card
        $body.on('mouseenter.tw_map_illustration', '#map-nav-pane .tw-map-pin', (e) => this.showHoverCard(e));
        $body.on('mouseleave.tw_map_illustration', '#map-nav-pane .tw-map-pin', () => this.hideHoverCard());
    }
    
    // --- Editor Mode Management ---
    async toggleEditorMode(e) {
        const $button = this.$(e.currentTarget);
        const $mapPane = this.$('#map-nav-pane');
        const isActive = !$mapPane.hasClass('editor-mode-active');
        $mapPane.toggleClass('editor-mode-active', isActive);
        $button.toggleClass('active', isActive);

        if (isActive) {
            this.logger.log('[Map Editor] Editor mode ACTIVATED');
            $button.text('完成编辑 ✅');
            this.dialogs.showMapEditorToolbox($mapPane);
            this.bindEditorEvents($mapPane);
            const bgUrl = await this.mapSystem.atlasManager.getBackgroundImage();
            this.$('#tw-map-bg-url').val(bgUrl || '');
        } else {
            this.logger.log('[Map Editor] Editor mode DEACTIVATED');
            $button.text('编辑地图 ✏️');
            this.exitPlacementMode();
            this.dialogs.hideMapEditorToolbox();
            this.unbindEditorEvents($mapPane);
            this.$('.tw-map-pin.selected').removeClass('selected');
        }
    }

    bindEditorEvents($mapPane) {
        $mapPane.on('click.tw_editor_event', '#tw-create-node-btn', () => this.enterPlacementMode());
        $mapPane.on('click.tw_editor_event', '.tw-map-pin', (e) => this.handlePinClick(e));
        $mapPane.on('mousedown.tw_editor_event', '.tw-sidebar-item', (e) => this.handleUnchartedDragStart(e));
        $mapPane.on('click.tw_editor_event', '.tw-map-node-tree-item', (e) => this.handleNodeListClick(e));
        this.bindToolboxEditorEvents($mapPane);
        
        $mapPane.on('click.tw_editor_event', '#tw-set-map-bg-btn', async (e) => {
            const $button = this.$(e.currentTarget);
            $button.text('正在保存...').prop('disabled', true);
            const newUrl = this.$('#tw-map-bg-url').val();
            await this.mapSystem.atlasManager.setBackgroundImage(newUrl);
            await this.renderer.renderMapPane(this.$('#map-nav-pane'));
            this.toastr.success('地图背景已更新！');
            $button.text('设置背景').prop('disabled', false);
        });
    }
    
    unbindEditorEvents($mapPane) {
        $mapPane.off('.tw_editor_event');
    }

    // --- Placement Workflow ---

    enterPlacementMode() {
        if (this.editorState.isPlacementMode) return;
        this.editorState.isPlacementMode = true;
        const $viewport = this.$('.tw-map-viewport');
        const $button = this.$('#tw-create-node-btn');
        $viewport.addClass('placement-mode');
        $button.addClass('placement-active').text('在地图上单击以放置节点...');
        $viewport.one('click.tw_placement', (e) => this.handlePlacementClick(e));
    }

    exitPlacementMode() {
        if (!this.editorState.isPlacementMode) return;
        this.editorState.isPlacementMode = false;
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

        const { mapState } = this.viewportManager;
        const $canvas = this.$('.tw-map-canvas');
        const viewportRect = e.currentTarget.getBoundingClientRect();
        const canvasX = (e.clientX - viewportRect.left - mapState.pan.x) / mapState.zoom;
        const canvasY = (e.clientY - viewportRect.top - mapState.pan.y) / mapState.zoom;
        
        const isIndoor = this.state.advancedMapPathStack.length > 0;
        const logicalMax = isIndoor ? 30 : 1200;

        const mapX = Math.round((canvasX / $canvas.width()) * logicalMax);
        const mapY = Math.round((canvasY / $canvas.height()) * logicalMax);

        this.exitPlacementMode();

        const id = prompt("输入新地点的唯一ID (例如: 'stormwind_keep'):");
        if (!id || this.mapSystem.mapDataManager.nodes.has(id)) {
            if (id) alert("错误: 该ID已存在。");
            return;
        }
        const name = prompt("输入新地点的名称 (例如: '暴风城要塞'):", "新地点");
        if (!name) return;

        await this.mapSystem.mapDataManager.processMapUpdate([{ op: 'add_or_update', id, name, coords: `${mapX},${mapY}` }]);
        this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
        await this.renderer.renderMapPane(this.$('#map-nav-pane'));
        await this.mapSystem.atlasManager.updateAtlas();
    }

    // --- Selection & Toolbox ---

    handlePinClick(e) {
        e.stopPropagation();
        this.selectNode(this.$(e.currentTarget).data('node-id'));
    }

    handleNodeListClick(e) {
        const nodeId = this.$(e.currentTarget).data('node-id');
        this.selectNode(nodeId);
        const node = this.mapSystem.mapDataManager.nodes.get(nodeId);
        if (node && node.coords) {
            this.viewportManager.recenterOnNode(nodeId);
        }
    }

    selectNode(nodeId) {
        this.$('.tw-map-pin.selected, .tw-map-node-tree-item.selected').removeClass('selected');
        this.$(`.tw-map-pin[data-node-id="${nodeId}"], .tw-map-node-tree-item[data-node-id="${nodeId}"]`).addClass('selected');
        this.dialogs.populateToolboxEditor(nodeId);
    }
    
    bindToolboxEditorEvents($container) {
        const saveNode = async () => {
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
            this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
            await this.renderer.renderMapPane(this.$('#map-nav-pane'));
            await this.mapSystem.atlasManager.updateAtlas();
        };

        $container.on('change.tw_editor_event', '.tw-map-node-editor [data-prop]', saveNode);
        $container.on('click.tw_editor_event', '.tw-clear-coords-btn', async (e) => {
            e.preventDefault();
            const nodeId = this.$('.tw-map-node-editor').data('current-node-id');
            if (!nodeId || !confirm(`确定要清除节点 "${nodeId}" 的坐标吗？\n该节点将变为“孤立节点”。`)) return;
            await this.mapSystem.mapDataManager.updateNodeDetail(nodeId, { coords: undefined });
            this.$('.tw-map-node-editor #node-coords').val('');
            await this.mapSystem.atlasManager.updateAtlas();
            await this.renderer.renderMapPane(this.$('#map-nav-pane'));
            this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
        });
        $container.on('click.tw_editor_event', '.tw-delete-node-btn', async () => {
             const nodeId = this.$('.tw-map-node-editor').data('current-node-id');
             const node = this.mapSystem.mapDataManager.nodes.get(nodeId);
             if (!node || !confirm(`确定要删除节点 "${node.name}" (${node.id}) 吗？\n此操作无法撤销！`)) return;
             this.dialogs.populateToolboxEditor(null);
             await this.mapSystem.mapDataManager.processMapUpdate([{ op: 'remove', id: nodeId }]);
             this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
             await this.renderer.renderMapPane(this.$('#map-nav-pane'));
             await this.mapSystem.atlasManager.updateAtlas();
        });
    }

    // --- Drag & Drop Handlers ---
    
    handleDragEnd(e) {
        if (this.editorState.isDraggingUncharted) this.handleUnchartedDragEnd(e);
    }
    
    handleDragMove(e) {
        if (this.editorState.isDraggingUncharted) this.handleUnchartedDragMove(e);
    }

    handleUnchartedDragStart(e) {
        if (!this.isEditorActive() || e.which !== 1) return;
        e.preventDefault(); e.stopPropagation();
        this.editorState.isDraggingUncharted = true;
        const $draggedItem = this.$(e.currentTarget);
        this.editorState.draggedUnchartedGhost = this.$('<div>').addClass('tw-uncharted-ghost').attr('data-node-id', $draggedItem.data('node-id')).text($draggedItem.text()).appendTo('body');
        this.handleUnchartedDragMove(e);
    }
    
    handleUnchartedDragMove(e) {
        if (!this.editorState.isDraggingUncharted) return;
        e.preventDefault();
        const coords = this.viewportManager._getEventCoords(e);
        this.editorState.draggedUnchartedGhost.css({ left: coords.clientX, top: coords.clientY });
    }
    
    async handleUnchartedDragEnd(e) {
        const { draggedUnchartedGhost } = this.editorState;
        if (!draggedUnchartedGhost) return;
        
        setTimeout(async () => {
            if (!this.isEditorActive()) {
                this.logger.warn('[Map Editor] Uncharted drag ended but editor is inactive. Cancelling operation.');
                if (this.editorState.draggedUnchartedGhost) this.editorState.draggedUnchartedGhost.remove();
                Object.assign(this.editorState, { draggedUnchartedGhost: null, isDraggingUncharted: false });
                return;
            }
    
            const nodeId = draggedUnchartedGhost.data('node-id');
            const coords = this.viewportManager._getEventCoords(e);
            const $viewport = this.$('.tw-map-viewport');
            if ($viewport.length > 0) {
                const viewportRect = $viewport[0].getBoundingClientRect();
                if (coords.clientX >= viewportRect.left && coords.clientX <= viewportRect.right && coords.clientY >= viewportRect.top && coords.clientY <= viewportRect.bottom) {
                    const { mapState } = this.viewportManager;
                    const canvasX = (coords.clientX - viewportRect.left - mapState.pan.x) / mapState.zoom;
                    const canvasY = (coords.clientY - viewportRect.top - mapState.pan.y) / mapState.zoom;
                    const $canvas = this.$('.tw-map-canvas');

                    const isIndoor = this.state.advancedMapPathStack.length > 0;
                    const logicalMax = isIndoor ? 30 : 1200;

                    const mapX = Math.round((canvasX / $canvas.width()) * logicalMax);
                    const mapY = Math.round((canvasY / $canvas.height()) * logicalMax);

                    await this.mapSystem.mapDataManager.updateNodeDetail(nodeId, { coords: `${mapX},${mapY}` });
                    await this.mapSystem.atlasManager.updateAtlas();
                    await this.renderer.renderMapPane(this.$('#map-nav-pane'));
                    this.dialogs._renderAndAttachNodeTree(this.$('.tw-map-node-tree'));
                }
            }
            draggedUnchartedGhost.remove();
            Object.assign(this.editorState, { draggedUnchartedGhost: null, isDraggingUncharted: false });
        }, 0);
    }

    handleEscapeKey() {
        if (this.editorState.isPlacementMode) {
            this.exitPlacementMode();
        }
    }
    
    showHoverCard(e) {
        const $pin = this.$(e.currentTarget);
        const nodeId = $pin.data('node-id');
        const node = this.mapSystem.mapDataManager.nodes.get(nodeId);
    
        if (node && (node.illustration || node.description)) {
            this.hideHoverCard();
    
            const $card = this.$('<div class="tw-map-hover-card"></div>');
            let $img = null;
    
            if (node.illustration) {
                const imageUrl = `${this.config.IMAGE_BASE_URL}${node.illustration}`;
                $img = this.$('<img>').attr('src', imageUrl);
                $card.append($img);
            }
    
            if (node.description) {
                $card.append(this.$('<p class="tw-map-hover-description"></p>').text(node.description));
            }
    
            this.$('body').append($card);
    
            const positionCard = () => {
                const cardWidth = $card.outerWidth(), cardHeight = $card.outerHeight();
                const winWidth = this.win.innerWidth, winHeight = this.win.innerHeight;
                const offset = 20;
                let top = e.clientY + offset, left = e.clientX + offset;
                if (left + cardWidth > winWidth) left = e.clientX - cardWidth - offset;
                if (top + cardHeight > winHeight) top = e.clientY - cardHeight - offset;
                $card.css({ top: `${top}px`, left: `${left}px` });
                requestAnimationFrame(() => $card.addClass('visible'));
            };
    
            if ($img) {
                $img.on('load', positionCard).on('error', () => {
                    $img.remove();
                    if (node.description) positionCard();
                    else $card.remove();
                });
                if ($img[0].complete) positionCard();
            } else {
                positionCard();
            }
        }
    }

    hideHoverCard() {
        const $card = this.$('.tw-map-hover-card');
        if ($card.length) {
            $card.removeClass('visible');
            setTimeout(() => $card.remove(), 300);
        }
    }
}