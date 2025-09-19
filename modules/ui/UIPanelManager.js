/**
 * The World - UI Panel Manager
 * @description Manages panel state, position, size, and physical interactions.
 */
export class UIPanelManager {
    constructor({ $, win, config, state, dataManager, logger }) {
        this.$ = $;
        this.win = win;
        this.config = config;
        this.state = state;
        this.dataManager = dataManager;
        this.logger = logger;
    }

    applyInitialPanelState() {
        this.logger.log('正在应用初始面板状态...');
        const $panel = this.$(`#${this.config.PANEL_ID}`);
        const $button = this.$(`#${this.config.TOGGLE_BUTTON_ID}`);
        if (!$panel.length) return;

        if (this.state.panelLeft === null || isNaN(this.state.panelLeft) ||
            this.state.panelTop === null || isNaN(this.state.panelTop) ||
            this.state.panelLeft > this.win.innerWidth - 50 ||
            this.state.panelTop > this.win.innerHeight - 50 ||
            this.state.panelLeft < -(this.state.panelWidth - 50) ||
            this.state.panelTop < 0) {
            this.logger.warn('面板位置无效或已偏离屏幕，正在重置到默认位置。');
            this.state.panelWidth = 450;
            this.state.panelHeight = this.win.innerHeight * 0.6;
            this.state.panelTop = 60;
            this.state.panelLeft = this.win.innerWidth - this.state.panelWidth - 20;
            this.dataManager.saveState();
        }

        if (this.state.panelHeight === null || isNaN(this.state.panelHeight)) {
            this.state.panelHeight = this.win.innerHeight * 0.6;
        }

        $panel.css({
            width: `${this.state.panelWidth}px`,
            height: `${this.state.panelHeight}px`,
            top: `${this.state.panelTop}px`,
            left: `${this.state.panelLeft}px`,
        });

        this.checkPanelWidth();
        this.logger.log(`初始面板位置和大小已设置:`, { top: this.state.panelTop, left: this.state.panelLeft, width: this.state.panelWidth, height: this.state.panelHeight });
    
        // Apply button position
        if (this.state.buttonLeft === null || isNaN(this.state.buttonLeft)) {
            this.state.buttonLeft = this.win.innerWidth - $button.outerWidth() - 10;
        }
        $button.css({ top: `${this.state.buttonTop}px`, left: `${this.state.buttonLeft}px` });
    }

    togglePanel(forceShow) {
        this.logger.log(`切换面板可见性 -> ${forceShow === undefined ? '自动' : (forceShow ? '强制显示' : '强制隐藏')}`);
        const $panel = this.$(`#${this.config.PANEL_ID}`);
        const isVisible = typeof forceShow === 'boolean' ? forceShow : !$panel.is(':visible');
        if (isVisible) {
            $panel.show();
        } else {
            $panel.hide();
        }
        this.state.isPanelVisible = isVisible;
        this.dataManager.saveState();
    }

    checkPanelWidth() {
        const $panel = this.$(`#${this.config.PANEL_ID}`);
        const panelWidth = $panel.width();
        $panel.toggleClass('narrow-layout', panelWidth < 420);
    }

    makeDraggable($element, $handle, isButton = false) {
        this.logger.log(`正在为 ${isButton ? '按钮' : '面板'} 设置拖动...`);
        const $doc = this.$(this.win.document);
        const getCoords = e => e.type.startsWith('touch') ? e.originalEvent.touches[0] || e.originalEvent.changedTouches[0] : e;

        $handle.off('mousedown.tw_drag touchstart.tw_drag').on('mousedown.tw_drag touchstart.tw_drag', (e) => {
            if (this.$(e.target).is('button, input, textarea, .tw-resize-handle, .tw-close') || this.$(e.target).closest('button, .tw-close').length) {
                return;
            }
            e.preventDefault();

            const coords = getCoords(e);
            const startX = coords.pageX;
            const startY = coords.pageY;
            const startPos = $element.position();

            const onMove = (moveEvent) => {
                const moveCoords = getCoords(moveEvent);
                let newLeft = startPos.left + (moveCoords.pageX - startX);
                let newTop = startPos.top + (moveCoords.pageY - startY);

                newTop = Math.max(0, Math.min(newTop, this.win.innerHeight - $element.outerHeight()));
                newLeft = Math.max(0, Math.min(newLeft, this.win.innerWidth - $element.outerWidth()));

                $element.css({ top: newTop + 'px', left: newLeft + 'px' });
            };

            const onEnd = () => {
                $doc.off('mousemove.tw_drag touchmove.tw_drag', onMove);
                $doc.off('mouseup.tw_drag touchend.tw_drag', onEnd);

                // This logic should apply to both panel and button
                const finalPos = $element.position();
                const snapThreshold = 50;
                const newPos = { top: finalPos.top, left: finalPos.left };
                let shouldAnimate = false;

                if (finalPos.top < snapThreshold) {
                    newPos.top = 0;
                    shouldAnimate = true;
                } else if (this.win.innerHeight - (finalPos.top + $element.outerHeight()) < snapThreshold) {
                    newPos.top = this.win.innerHeight - $element.outerHeight();
                    shouldAnimate = true;
                }

                if (finalPos.left < snapThreshold) {
                    newPos.left = 0;
                    shouldAnimate = true;
                } else if (this.win.innerWidth - (finalPos.left + $element.outerWidth()) < snapThreshold) {
                    newPos.left = this.win.innerWidth - $element.outerWidth();
                    shouldAnimate = true;
                }

                const saveState = (pos) => {
                    if (isButton) {
                        this.state.buttonTop = pos.top;
                        this.state.buttonLeft = pos.left;
                    } else {
                        this.state.panelTop = pos.top;
                        this.state.panelLeft = pos.left;
                    }
                    this.dataManager.saveState();
                };

                if (shouldAnimate) {
                    $element.animate(newPos, 200, () => saveState(newPos));
                } else {
                    saveState(finalPos);
                }
            };

            $doc.on('mousemove.tw_drag touchmove.tw_drag', onMove);
            $doc.on('mouseup.tw_drag touchend.tw_drag', onEnd);
        });
    }

    makeResizable($element, $handle) {
        this.logger.log('正在为面板设置调整大小功能...');
        const $doc = this.$(this.win.document);
        const getCoords = e => e.type.startsWith('touch') ? e.originalEvent.touches[0] || e.originalEvent.changedTouches[0] : e;

        $handle.on('mousedown.tw_resize touchstart.tw_resize', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const coords = getCoords(e);
            const startX = coords.pageX;
            const startY = coords.pageY;
            const startWidth = $element.width();
            const startHeight = $element.height();
            const minWidth = 280;
            const minHeight = 200;

            const onMove = (moveEvent) => {
                const moveCoords = getCoords(moveEvent);
                let newWidth = startWidth + (moveCoords.pageX - startX);
                let newHeight = startHeight + (moveCoords.pageY - startY);

                newWidth = Math.max(minWidth, newWidth);
                newHeight = Math.max(minHeight, newHeight);

                const pos = $element.position();
                if (pos.left + newWidth > this.win.innerWidth) {
                    newWidth = this.win.innerWidth - pos.left;
                }
                if (pos.top + newHeight > this.win.innerHeight) {
                    newHeight = this.win.innerHeight - pos.top;
                }

                $element.css({ width: newWidth + 'px', height: newHeight + 'px' });
                this.checkPanelWidth();
            };

            const onEnd = () => {
                $doc.off('mousemove.tw_resize touchmove.tw_resize', onMove);
                $doc.off('mouseup.tw_resize touchend.tw_resize', onEnd);
                this.state.panelWidth = $element.width();
                this.state.panelHeight = $element.height();
                this.dataManager.saveState();
            };

            $doc.on('mousemove.tw_resize touchmove.tw_resize', onMove);
            $doc.on('mouseup.tw_resize touchend.tw_resize', onEnd);
        });
    }
}