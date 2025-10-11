/**
 * The World - Map Viewport Manager
 * @description Manages all map viewport interactions: panning, zooming, and related UI updates.
 */
export class MapViewportManager {
    constructor(dependencies) {
        Object.assign(this, dependencies);
        this.mapState = {
            pan: { x: 0, y: 0 },
            zoom: 1,
            isPanning: false,
            startPos: { x: 0, y: 0 },
        };
    }

    bindEvents() {
        const $body = this.$('body');
        $body.on('mousedown.tw_map_pan touchstart.tw_map_pan', '.tw-map-viewport', (e) => this.handleMapPanStart(e));
        $body.on('wheel.tw_map_zoom', '.tw-map-viewport', (e) => this.handleMapZoom(e));
        $body.on('click.tw_map_zoom_btn', '.tw-map-zoom-btn', (e) => this.handleZoomButtonClick(e));
    }

    // --- Core Transform and Update Logic ---

    applyMapTransform() {
        const $viewport = this.$('.tw-map-viewport');
        if (!$viewport.length) return;
    
        const { pan, zoom } = this.mapState;
        $viewport.find('.tw-map-canvas, .tw-map-lines-svg').css('transform', `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`);
        
        // LOD Scaling for pins
        const inverseZoom = 1 / zoom;
        // Combine scale with the existing centering transform
        $viewport.find('.tw-map-pin').css('transform', `translate(-50%, -50%) scale(${inverseZoom})`);
        
        // LOD Scaling for SVG lines
        const baseStrokeWidth = 2; // As defined in advanced_map.css
        $viewport.find('.tw-map-line').css('stroke-width', `${baseStrokeWidth / zoom}px`);

        this.updateMapOverlays();
    }

    updateMapOverlays() {
        const $viewport = this.$('.tw-map-viewport');
        if (!$viewport.length) return;
        const { pan, zoom } = this.mapState;
    
        const grid_size = 25 * zoom;
        const bg_position = `${pan.x}px ${pan.y}px`;
    
        $viewport.css({
            'background-size': `${grid_size}px ${grid_size}px`,
            'background-position': bg_position
        });
    
        // Add zoom level classes for LOD styling
        $viewport.removeClass('zoom-far zoom-mid zoom-near');
        if (zoom < 0.7) {
            $viewport.addClass('zoom-far');
        } else if (zoom >= 0.7 && zoom < 1.8) {
            $viewport.addClass('zoom-mid');
        } else {
            $viewport.addClass('zoom-near');
        }

        this._updatePinVisibility();
        this._updateRulers();
    }

    _getEventCoords(e) {
        return e.type.startsWith('touch') ? e.originalEvent.touches[0] || e.originalEvent.changedTouches[0] : e;
    }

    // --- Pan Handlers ---

    handleMapPanStart(e) {
        if (this.$(e.target).closest('.tw-map-pin, .tw-map-sidebar, .tw-map-editor-toolbox').length > 0 || this.mapEditorManager?.isPlacementMode) return;
        e.preventDefault();
        this.mapState.isPanning = true;
        const coords = this._getEventCoords(e);
        this.mapState.startPos = { x: coords.clientX - this.mapState.pan.x, y: coords.clientY - this.mapState.pan.y };
        this.$(e.currentTarget).css('cursor', 'grabbing');
    }

    handleMapPanMove(e) {
        if (!this.mapState.isPanning) return;
        e.preventDefault(); // Prevent text selection on drag
        const coords = this._getEventCoords(e);
        this.mapState.pan.x = coords.clientX - this.mapState.startPos.x;
        this.mapState.pan.y = coords.clientY - this.mapState.startPos.y;
        this.applyMapTransform();
    }

    handleMapPanEnd(e) {
        if (!this.mapState.isPanning) return;
        this.mapState.isPanning = false;
        this.$('.tw-map-viewport').css('cursor', 'grab');
    }

    // --- Zoom Handlers ---

    handleMapZoom(e) {
        e.preventDefault();
        const $viewport = this.$(e.currentTarget);
        const delta = e.originalEvent.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.2, Math.min(5, this.mapState.zoom + delta));
        
        const rect = $viewport[0].getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        this.zoomAtPoint(newZoom, mouseX, mouseY);
    }

    handleZoomButtonClick(e) {
        const direction = this.$(e.currentTarget).data('zoom-direction');
        const currentZoom = this.mapState.zoom;
        const zoomStep = 0.2 * currentZoom;
        const newZoom = Math.max(0.2, Math.min(5, direction === 'in' ? currentZoom + zoomStep : currentZoom - zoomStep));

        const $viewport = this.$('.tw-map-viewport');
        const rect = $viewport[0].getBoundingClientRect();
        this.zoomAtPoint(newZoom, rect.width / 2, rect.height / 2);
    }

    zoomAtPoint(newZoom, pivotX, pivotY) {
        const worldX = (pivotX - this.mapState.pan.x) / this.mapState.zoom;
        const worldY = (pivotY - this.mapState.pan.y) / this.mapState.zoom;
        
        this.mapState.pan.x = pivotX - worldX * newZoom;
        this.mapState.pan.y = pivotY - worldY * newZoom;
        this.mapState.zoom = newZoom;
        
        this.applyMapTransform();
    }
    
    recenterOnNode(nodeId) {
        const node = this.mapSystem.mapDataManager.nodes.get(nodeId);
        if (!node || !node.coords) {
            this.toastr.warning('无法定位：该地点没有坐标。');
            return;
        }

        const [x, y] = node.coords.split(',').map(Number);
        const $canvas = this.$('.tw-map-canvas');
        const $viewport = this.$('.tw-map-viewport');
        if (!$canvas.length || !$viewport.length) return;

        const isIndoor = this.state.advancedMapPathStack.length > 0;
        const logicalMax = isIndoor ? 30 : 1200;

        const targetZoom = 1.5;
        const canvasX = (x / logicalMax) * $canvas.width();
        const canvasY = (y / logicalMax) * $canvas.height();

        const targetPanX = ($viewport.width() / 2) - (canvasX * targetZoom);
        const targetPanY = ($viewport.height() / 2) - (canvasY * targetZoom);

        const startPan = { ...this.mapState.pan };
        const startZoom = this.mapState.zoom;

        this.$({ panX: startPan.x, panY: startPan.y, zoom: startZoom }).animate({
            panX: targetPanX,
            panY: targetPanY,
            zoom: targetZoom
        }, {
            duration: 500,
            easing: 'swing',
            step: (now, fx) => {
                if (fx.prop === 'panX') this.mapState.pan.x = now;
                if (fx.prop === 'panY') this.mapState.pan.y = now;
                if (fx.prop === 'zoom') this.mapState.zoom = now;
                this.applyMapTransform();
            },
            complete: () => {
                this.mapState.pan = { x: targetPanX, y: targetPanY };
                this.mapState.zoom = targetZoom;
                this.applyMapTransform();
            }
        });
    }

    resetView() {
        const targetPan = { x: 0, y: 0 };
        const targetZoom = 1.0;

        const startPan = { ...this.mapState.pan };
        const startZoom = this.mapState.zoom;

        this.$({ panX: startPan.x, panY: startPan.y, zoom: startZoom }).animate({
            panX: targetPan.x,
            panY: targetPan.y,
            zoom: targetZoom
        }, {
            duration: 500,
            easing: 'swing',
            step: (now, fx) => {
                if (fx.prop === 'panX') this.mapState.pan.x = now;
                if (fx.prop === 'panY') this.mapState.pan.y = now;
                if (fx.prop === 'zoom') this.mapState.zoom = now;
                this.applyMapTransform();
            },
            complete: () => {
                this.mapState.pan = targetPan;
                this.mapState.zoom = targetZoom;
                this.applyMapTransform();
            }
        });
    }

    fitToBounds() {
        const plottedNodes = Array.from(this.mapSystem.mapDataManager.nodes.values()).filter(n => n.coords);
        if (plottedNodes.length === 0) {
            this.toastr.info('地图上没有可定位的节点。');
            this.resetView();
            return;
        }

        const $canvas = this.$('.tw-map-canvas');
        const $viewport = this.$('.tw-map-viewport');
        if (!$canvas.length || !$viewport.length) return;
        
        const isIndoor = this.state.advancedMapPathStack.length > 0;
        const logicalMax = isIndoor ? 30 : 1200;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        plottedNodes.forEach(node => {
            const [x, y] = node.coords.split(',').map(Number);
            const canvasX = (x / logicalMax) * $canvas.width();
            const canvasY = (y / logicalMax) * $canvas.height();
            minX = Math.min(minX, canvasX);
            maxX = Math.max(maxX, canvasX);
            minY = Math.min(minY, canvasY);
            maxY = Math.max(maxY, canvasY);
        });

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const viewportWidth = $viewport.width();
        const viewportHeight = $viewport.height();

        if (boundsWidth === 0 && boundsHeight === 0) {
            this.recenterOnNode(plottedNodes[0].id);
            return;
        }

        const padding = 0.9; // 90% zoom to give some space around the edges
        const zoomX = boundsWidth > 0 ? (viewportWidth / boundsWidth) * padding : Infinity;
        const zoomY = boundsHeight > 0 ? (viewportHeight / boundsHeight) * padding : Infinity;
        const targetZoom = Math.min(5, Math.max(0.2, Math.min(zoomX, zoomY)));

        const boundsCenterX = minX + boundsWidth / 2;
        const boundsCenterY = minY + boundsHeight / 2;
        const targetPanX = (viewportWidth / 2) - (boundsCenterX * targetZoom);
        const targetPanY = (viewportHeight / 2) - (boundsCenterY * targetZoom);

        // Animate to the new view
        const startPan = { ...this.mapState.pan };
        const startZoom = this.mapState.zoom;
        this.$({ panX: startPan.x, panY: startPan.y, zoom: startZoom }).animate({
            panX: targetPanX,
            panY: targetPanY,
            zoom: targetZoom
        }, {
            duration: 700,
            easing: 'swing',
            step: (now, fx) => {
                if (fx.prop === 'panX') this.mapState.pan.x = now;
                if (fx.prop === 'panY') this.mapState.pan.y = now;
                if (fx.prop === 'zoom') this.mapState.zoom = now;
                this.applyMapTransform();
            },
            complete: () => {
                this.mapState.pan = { x: targetPanX, y: targetPanY };
                this.mapState.zoom = targetZoom;
                this.applyMapTransform();
            }
        });
    }

    // --- Overlay Update Methods ---

    _updatePinVisibility() {
        // LOD (Level of Detail) has been disabled per user feedback.
        // All pins are now always visible. This function ensures the class is removed.
        this.$('.tw-map-pin').removeClass('tw-pin-hidden');
    }

    _updateRulers() {
        const $rulerX = this.$('.tw-map-ruler-x');
        const $rulerY = this.$('.tw-map-ruler-y');
        if ($rulerX.length === 0 || $rulerY.length === 0) return;

        const { pan, zoom } = this.mapState;
        const $viewport = this.$('.tw-map-viewport');
        const vw = $viewport.width();
        const vh = $viewport.height();

        $rulerX.empty();
        $rulerY.empty();
        
        const isIndoor = this.state.advancedMapPathStack.length > 0;
        const logicalMax = isIndoor ? 30 : 1200;
        const $canvas = this.$('.tw-map-canvas');
        if (!$canvas.length) return;
        
        const canvasSize = $canvas.width(); // Use actual canvas size for calculations

        const worldLeft = -pan.x / zoom;
        const worldRight = (vw - pan.x) / zoom;
        const worldTop = -pan.y / zoom;
        const worldBottom = (vh - pan.y) / zoom;
        
        const getNiceInterval = (span, logicalSpan) => {
            const minTicks = 5;
            if (span <= 0) return logicalSpan / 4;
            const roughInterval = logicalSpan / minTicks;
            const power = Math.pow(10, Math.floor(Math.log10(roughInterval)));
            const mag = roughInterval / power;

            if (mag < 1.5) return power;
            if (mag < 3) return 2 * power;
            if (mag < 7) return 5 * power;
            return 10 * power;
        };
        
        const intervalX = getNiceInterval(worldRight - worldLeft, logicalMax);
        const firstTickX = Math.ceil(worldLeft / (canvasSize / logicalMax) / intervalX) * intervalX;

        for (let x = firstTickX; x <= (worldRight / (canvasSize / logicalMax)); x += intervalX) {
            const screenX = x * (canvasSize / logicalMax) * zoom + pan.x;
            if (screenX >= 0 && screenX <= vw) {
                const height = x % (intervalX * 2) === 0 ? '50%' : '25%';
                $rulerX.append(`<div class="tw-ruler-tick" style="left:${screenX}px; height:${height};"></div>`);
                if (x % (intervalX * 2) === 0) {
                     $rulerX.append(`<div class="tw-ruler-tick-label" style="left:${screenX}px;">${Math.round(x)}</div>`);
                }
            }
        }
        
        const intervalY = getNiceInterval(worldBottom - worldTop, logicalMax);
        const firstTickY = Math.ceil(worldTop / (canvasSize / logicalMax) / intervalY) * intervalY;
        
        for (let y = firstTickY; y <= (worldBottom / (canvasSize / logicalMax)); y += intervalY) {
            const screenY = y * (canvasSize / logicalMax) * zoom + pan.y;
            if (screenY >= 0 && screenY <= vh) {
                const width = y % (intervalY * 2) === 0 ? '50%' : '25%';
                 $rulerY.append(`<div class="tw-ruler-tick" style="top:${screenY}px; width:${width};"></div>`);
                if (y % (intervalY * 2) === 0) {
                     const labelValue = Math.round(y);
                     $rulerY.append(`<div class="tw-ruler-tick-label" style="top:${screenY}px;">${labelValue}</div>`);
                }
            }
        }
    }
}