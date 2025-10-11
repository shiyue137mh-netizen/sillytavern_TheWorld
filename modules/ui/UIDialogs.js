/**
 * The World - UI Dialogs
 * @description Manages all popup dialogs.
 */
export class UIDialogs {
    constructor({ $, state, win, logger, config, triggerSlash, timeGradient, mapSystem, renderer }) {
        this.$ = $;
        this.state = state;
        this.win = win;
        this.logger = logger;
        this.config = config;
        this.triggerSlash = triggerSlash;
        this.timeGradient = timeGradient;
        this.mapSystem = mapSystem;
        this.renderer = renderer;
    }

    showKeywordInteractDialog(keyword) {
        this.removeDialog();
        const content = this.$(`<div><textarea placeholder="对 '${keyword}' 做什么?(例如：检查、拿起...)"></textarea></div>`);
        const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">取消</button><button class="dialog_confirm has-ripple">确认</button></div>');
        const dialog = this.createDialog(`与 '${keyword}' 互动`, content, buttons);
        dialog.find('.dialog_cancel').on('click', () => this.removeDialog());
        dialog.find('.dialog_confirm').on('click', () => {
            const userInput = dialog.find("textarea").val() || `观察 ${keyword}`;
            this.triggerSlash(`/send {{user}} ${userInput} ${keyword} | /trigger`);
            this.removeDialog();
        });
    }

    showWeatherInteractDialog() {
        this.removeDialog();

        const weatherData = {
            '晴天': { variants: { '放晴': {}, '流星': {}, '萤火虫': {} } },
            '云':   { variants: { '少云': {}, '多云': {}, '阴天': {} } },
            '风':   { variants: { '微风': {}, '大风': {}, '狂风': {} } },
            '雨':   { variants: { '小雨': {}, '中雨': {}, '大雨': {}, '暴雨': { addons: { '雷电': {} } } } },
            '雪':   { variants: { '小雪': {}, '中雪': {}, '大雪': {}, '暴雨': {} } },
            '特殊': { variants: { '樱花雨': {}, '起雾': {}, '烟花': {} } }
        };

        const content = this.$(`
            <div class="tw-weather-scroller-container">
                <div class="tw-weather-scroller-column" id="tw-weather-type"></div>
                <div class="tw-weather-scroller-column" id="tw-weather-variant"></div>
                <div class="tw-weather-scroller-column" id="tw-weather-addon"></div>
                <div class="tw-weather-scroller-highlight"></div>
            </div>
        `);
        
        const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">关闭</button><button class="dialog_confirm has-ripple">确认</button></div>');
        const dialog = this.createDialog('改变天气', content, buttons);

        const columns = {
            type: dialog.find('#tw-weather-type'),
            variant: dialog.find('#tw-weather-variant'),
            addon: dialog.find('#tw-weather-addon')
        };
        
        let selections = { type: null, variant: null, addon: null };

        const populateColumn = (colName, items) => {
            const $col = columns[colName];
            $col.empty();
            if (!items || items.length === 0) {
                $col.addClass('disabled');
                return;
            }
            $col.removeClass('disabled');
            const $list = this.$('<ul class="tw-weather-scroller-list">');
            $list.css('padding-top', '50px'); // Padding for centering first item
            items.forEach(item => {
                $list.append(`<li class="tw-weather-scroller-item" data-value="${item}">${item}</li>`);
            });
            $list.append('<li class="tw-weather-scroller-item" style="height: 50px;"></li>'); // Padding for centering last item
            $col.append($list);
        };
        
        const setupScroller = ($col) => {
            const $list = $col.find('.tw-weather-scroller-list');
            if (!$list.length) return;

            let isDragging = false, startY, startTop;
            const itemHeight = 50;
            const $doc = this.$(this.win.document);

            const snap = () => {
                const currentTop = parseInt($list.css('transform').split(',')[5] || 0, 10) || 0;
                let selectedIndex = Math.round(-currentTop / itemHeight);
                const itemCount = $list.children().length - 2; // -2 for top padding and bottom dummy li
                selectedIndex = Math.max(0, Math.min(selectedIndex, itemCount - 1)); // Corrected boundary

                $list.css('transform', `translateY(${-selectedIndex * itemHeight}px)`);
                $list.children('.selected').removeClass('selected');
                const $selectedItem = $list.children().eq(selectedIndex);
                $selectedItem.addClass('selected');

                const colName = $col.attr('id').split('-')[2];
                const newValue = $selectedItem.data('value');

                if (selections[colName] !== newValue) {
                    selections[colName] = newValue;
                    updateDependentColumns(colName);
                }
            };
            
            const getCoords = e => e.type.startsWith('touch') ? e.originalEvent.touches[0] || e.originalEvent.changedTouches[0] : e;

            const onDragStart = (e) => {
                if ($col.hasClass('disabled')) return;
                e.preventDefault();
                isDragging = true;
                const coords = getCoords(e);
                startY = coords.pageY;
                startTop = parseInt($list.css('transform').split(',')[5] || 0, 10) || 0;
                $list.css('transition', 'none');
                $col.addClass('grabbing');
                $doc.on('mousemove.tw_scroller touchmove.tw_scroller', onDragMove);
                $doc.on('mouseup.tw_scroller touchend.tw_scroller', onDragEnd);
            };

            const onDragMove = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const moveCoords = getCoords(e);
                const deltaY = moveCoords.pageY - startY;
                
                const itemCount = $list.children().length - 2;
                const minTop = -(itemCount - 1) * itemHeight; // Corrected boundary
                const maxTop = 0; // First item
                const newTop = Math.max(minTop, Math.min(maxTop, startTop + deltaY));

                $list.css('transform', `translateY(${newTop}px)`);
            };

            const onDragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                $col.removeClass('grabbing');
                $list.css('transition', 'transform 0.2s ease-out');
                snap();
                $doc.off('.tw_scroller');
            };

            $col.on('mousedown.tw_scroller touchstart.tw_scroller', onDragStart);
        };

        const updateDependentColumns = (changedColName) => {
            if (changedColName === 'type') {
                const typeData = weatherData[selections.type];
                const variantItems = typeData ? Object.keys(typeData.variants) : [];
                populateColumn('variant', variantItems);
                selections.variant = variantItems[0];
                setupScroller(columns.variant);
                columns.variant.find('.tw-weather-scroller-list').css('transform', 'translateY(0px)').children().eq(0).addClass('selected');
            }

            const typeData = weatherData[selections.type];
            if (!typeData) return;
            const variantData = typeData.variants[selections.variant];
            const addonItems = (variantData && variantData.addons) ? Object.keys(variantData.addons) : [];
            populateColumn('addon', addonItems);
            selections.addon = addonItems.length > 0 ? addonItems[0] : null;
            setupScroller(columns.addon);
             if(addonItems.length > 0) {
                columns.addon.find('.tw-weather-scroller-list').css('transform', 'translateY(0px)').children().eq(0).addClass('selected');
            }
        };

        // Initial Population
        const typeKeys = Object.keys(weatherData);
        populateColumn('type', typeKeys);
        selections.type = typeKeys[0];
        updateDependentColumns('type');
        Object.values(columns).forEach(setupScroller);
        
        setTimeout(() => {
            columns.type.find('.tw-weather-scroller-list').children().eq(0).addClass('selected');
            columns.variant.find('.tw-weather-scroller-list').children().eq(0).addClass('selected');
        }, 50);

        dialog.find('.dialog_confirm').on('click', () => {
            let finalText = '';
            if (selections.type === '晴天') {
                 switch(selections.variant) {
                    case '放晴': finalText = '天空放晴，乌云散去，阳光洒了下来。'; break;
                    case '流星': finalText = '夜空中划过数道流星。'; break;
                    case '萤火虫': finalText = '几只萤火虫在黑暗中飞舞。'; break;
                 }
            } else if (selections.type === '特殊') {
                 switch(selections.variant) {
                    case '樱花雨': finalText = '风中带来了樱花瓣，下起了樱花雨。'; break;
                    case '起雾': finalText = '四周开始起雾了。'; break;
                    case '烟花': finalText = '夜空中绽放出绚烂的烟花。'; break;
                 }
            } else {
                finalText = `天空${selections.variant}了。`;
                if (selections.addon) {
                    finalText = `天空${selections.variant}，并伴有${selections.addon}。`;
                }
            }
            
            this.triggerSlash(`/send <${finalText}> | /trigger`);
            this.removeDialog();
        });
        dialog.find('.dialog_cancel').on('click', () => this.removeDialog());
    }

    showTimeInteractDialog() {
        this.removeDialog();
        const now = new Date();
        let year, month, day, hour, minute, second;

        if (this.state.latestWorldStateData && this.state.latestWorldStateData['时间']) {
            const match = this.state.latestWorldStateData['时间'].match(/(\d{4})[年-]?.*?(\d{1,2})[月-]?(\d{1,2})[日-]?.*?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
            if (match) {
                [, year, month, day, hour, minute, second] = match.map(Number);
                month -= 1; 
            }
        }
        
        const currentDate = new Date(year || now.getFullYear(), month || now.getMonth(), day || now.getDate());
        currentDate.setHours(hour || now.getHours());
        currentDate.setMinutes(minute || now.getMinutes());
        currentDate.setSeconds(second || 0);

        const state = {
            selectedDate: new Date(currentDate),
            displayDate: new Date(currentDate),
        };

        const content = this.$(`
            <div class="tw-time-control-container">
                <div class="tw-calendar-container">
                    <div class="tw-calendar-header">
                        <button id="tw-prev-month">◄</button>
                        <span>
                            <input type="number" id="tw-year-input" value="${state.displayDate.getFullYear()}" min="1"> 年 
                            <input type="number" id="tw-month-input" value="${state.displayDate.getMonth() + 1}" min="1" max="12"> 月
                        </span>
                        <button id="tw-next-month">►</button>
                    </div>
                    <div class="tw-calendar">
                        <table>
                            <thead><tr><th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th></tr></thead>
                            <tbody id="tw-calendar-body"></tbody>
                        </table>
                    </div>
                </div>
                <div class="tw-clock-wrapper">
                    <div class="tw-clock-container">
                        <div class="tw-clock">
                            <div class="tw-clock-hand tw-hour-hand" id="tw-hour-hand"></div>
                            <div class="tw-clock-hand tw-minute-hand" id="tw-minute-hand"></div>
                            <div class="tw-clock-hand tw-second-hand" id="tw-second-hand"></div>
                            <div class="tw-clock-center"></div>
                        </div>
                    </div>
                    <div class="tw-digital-time">
                        <input type="number" id="tw-hour-input" min="0" max="23">
                        <span>:</span>
                        <input type="number" id="tw-minute-input" min="0" max="59">
                    </div>
                </div>
            </div>
        `);
        
        const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">关闭</button><button class="dialog_confirm has-ripple">确认</button></div>');
        const dialog = this.createDialog('设定时间', content, buttons);
        
        const calendarBody = dialog.find('#tw-calendar-body');
        const hourHand = dialog.find('#tw-hour-hand');
        const minuteHand = dialog.find('#tw-minute-hand');
        const secondHand = dialog.find('#tw-second-hand');
        const hourInput = dialog.find('#tw-hour-input');
        const minuteInput = dialog.find('#tw-minute-input');
        const yearInput = dialog.find('#tw-year-input');
        const monthInput = dialog.find('#tw-month-input');

        const renderCalendar = () => {
            calendarBody.empty();
            const year = state.displayDate.getFullYear();
            const month = state.displayDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            let date = 1;
            for (let i = 0; i < 6; i++) {
                const row = this.$('<tr>');
                for (let j = 0; j < 7; j++) {
                    const cell = this.$('<td>');
                    if (i === 0 && j < firstDay) {
                        // empty cells
                    } else if (date > daysInMonth) {
                        break;
                    } else {
                        cell.text(date).data('day', date).addClass('tw-calendar-day');
                        if (date === state.selectedDate.getDate() && month === state.selectedDate.getMonth() && year === state.selectedDate.getFullYear()) {
                            cell.addClass('selected');
                        }
                        date++;
                    }
                    row.append(cell);
                }
                calendarBody.append(row);
                if (date > daysInMonth) break;
            }
        };

        const updateClock = (h, m, s) => {
            const hourDeg = (h % 12 + m / 60) * 30;
            const minuteDeg = m * 6;
            const secondDeg = s * 6;
            hourHand.css('transform', `translateX(-50%) rotate(${hourDeg}deg)`);
            minuteHand.css('transform', `translateX(-50%) rotate(${minuteDeg}deg)`);
            if (secondHand) {
                 secondHand.css('transform', `translateX(-50%) rotate(${secondDeg}deg)`);
            }
        };

        const updateInputs = (h, m) => {
            hourInput.val(String(h).padStart(2, '0'));
            minuteInput.val(String(m).padStart(2, '0'));
        };
        
        const updateAll = () => {
            const h = state.selectedDate.getHours();
            const m = state.selectedDate.getMinutes();
            const s = state.selectedDate.getSeconds();
            yearInput.val(state.displayDate.getFullYear());
            monthInput.val(state.displayDate.getMonth() + 1);
            renderCalendar();
            updateClock(h, m, s);
            updateInputs(h, m);
        };
        
        updateAll();
        
        this.$(this.win.document).on('tw-time-tick.twDialog', (e, time) => {
            state.selectedDate.setHours(time.hours, time.minutes, time.seconds);
            updateClock(time.hours, time.minutes, time.seconds);
            if (!hourInput.is(':focus') && !minuteInput.is(':focus')) {
                updateInputs(time.hours, time.minutes);
            }
        });

        dialog.find('#tw-prev-month').on('click', () => { state.displayDate.setMonth(state.displayDate.getMonth() - 1); updateAll(); });
        dialog.find('#tw-next-month').on('click', () => { state.displayDate.setMonth(state.displayDate.getMonth() + 1); updateAll(); });
        yearInput.on('change', () => { state.displayDate.setFullYear(parseInt(yearInput.val())); updateAll(); });
        monthInput.on('change', () => { state.displayDate.setMonth(parseInt(monthInput.val()) - 1); updateAll(); });
        calendarBody.on('click', '.tw-calendar-day', (e) => {
            const day = this.$(e.currentTarget).data('day');
            state.selectedDate.setFullYear(state.displayDate.getFullYear(), state.displayDate.getMonth(), day);
            updateAll();
        });

        hourInput.on('change', () => { state.selectedDate.setHours(parseInt(hourInput.val())); updateAll(); });
        minuteInput.on('change', () => { state.selectedDate.setMinutes(parseInt(minuteInput.val())); updateAll(); });

        const handleHandDrag = (e, hand) => {
            e.preventDefault();
            const clock = dialog.find('.tw-clock-container');
            const rect = clock[0].getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const moveHandler = (moveEvent) => {
                const clientX = moveEvent.clientX || moveEvent.touches[0].clientX;
                const clientY = moveEvent.clientY || moveEvent.touches[0].clientY;
                const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
                
                if (hand === 'hour') {
                    let h = Math.round((angle < 0 ? angle + 360 : angle) / 30);
                    if (h === 0) h = 12;
                    if (state.selectedDate.getHours() >= 12 && h !== 12) h += 12;
                    else if (state.selectedDate.getHours() < 12 && h === 12) h = 0;
                    state.selectedDate.setHours(h);
                } else if (hand === 'minute') {
                    let m = Math.round((angle < 0 ? angle + 360 : angle) / 6);
                    if (m === 60) m = 0;
                    state.selectedDate.setMinutes(m);
                }
                updateAll();
            };

            this.$(document).on('mousemove touchmove', moveHandler).one('mouseup touchend', () => {
                this.$(document).off('mousemove touchmove', moveHandler);
            });
        };

        hourHand.on('mousedown touchstart', (e) => handleHandDrag(e, 'hour'));
        minuteHand.on('mousedown touchstart', (e) => handleHandDrag(e, 'minute'));

        dialog.find('.dialog_cancel').on('click', () => this.removeDialog());
        dialog.find('.dialog_confirm').on('click', () => {
            const y = state.selectedDate.getFullYear();
            const m = state.selectedDate.getMonth() + 1;
            const d = state.selectedDate.getDate();
            const h = String(state.selectedDate.getHours()).padStart(2, '0');
            const min = String(state.selectedDate.getMinutes()).padStart(2, '0');
            const fullTimeString = `${y}年${m}月${d}日 ${h}:${min}`;
            const text = `时间流动，来到了${fullTimeString}。`;
            this.triggerSlash(`/send <${text}> | /trigger`);
            this.removeDialog();
        });
    }

    showNpcInteractDialog(charName) {
        this.removeDialog();
        const placeholderText = `与 ${charName} 进行互动`;
        const content = this.$(`<div><textarea placeholder="${placeholderText}"></textarea></div>`);
        const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">取消</button><button class="dialog_confirm has-ripple">确认</button></div>');
        const dialog = this.createDialog('与 ' + charName + ' 互动', content, buttons);
        dialog.find('.dialog_cancel').on('click', () => this.removeDialog());
        dialog.find('.dialog_confirm').on('click', () => {
            const userInput = dialog.find('textarea').val() || `与 ${charName} 互动`;
            const command = `<request:{{user}}来到 ${charName} 的附近并${userInput}>`;
            this.triggerSlash(`/send ${command} | /trigger`);
            this.removeDialog();
        });
    }

    showNodeInteractionDialog(node, event) {
        this.removeDialog();

        const $content = this.$('<div class="tw-node-interaction-menu"></div>');

        // --- NEW DYNAMIC BUTTON LOGIC ---
        const isOutdoorView = this.state.advancedMapPathStack.length === 0;
        const enterableTypes = ['building', 'dungeon', 'landmark', 'shop', 'house', 'camp'];
        if (isOutdoorView && enterableTypes.includes(node.type)) {
            const $buttonEnter = this.$('<button class="has-ripple"><span class="button-icon">🚪</span> 进入</button>');
            $buttonEnter.on('click', async () => {
                this.logger.log(`[Map] Entering indoor view for: ${node.name} (${node.id})`);
                this.state.advancedMapPathStack.push(node.id);
                await this.renderer.renderMapPane(this.$('#map-nav-pane'));
                this.removeDialog();
            });
            $content.append($buttonEnter);
        }

        const $buttonGo = this.$('<button class="has-ripple"><span class="button-icon" style="font-size: 1.2em;">➡️</span> 前往</button>');
        $buttonGo.on('click', () => {
            const command = `/send {{user}}试图移动到 ${node.name} | /trigger`;
            this.triggerSlash(command);
            this.toastr.info(`正在尝试移动到: ${node.name}`);
            this.removeDialog();
        });
        
        $content.append($buttonGo);

        const $overlay = this.$('<div class="ws-dialog-overlay tw-context-menu-overlay"></div>');
        const $menu = this.$('<div class="tw-context-menu"></div>');

        $menu.append(`<h4>${node.name}</h4>`);
        $menu.append($content);

        const menuWidth = 150; 
        const menuHeight = 100;
        let top = event.clientY;
        let left = event.clientX;

        if (left + menuWidth > this.win.innerWidth - 20) {
            left = event.clientX - menuWidth;
        }
        if (top + menuHeight > this.win.innerHeight - 20) {
            top = event.clientY - menuHeight;
        }
        $menu.css({ top: `${top}px`, left: `${left}px` });

        $overlay.append($menu);
        this.$("body").append($overlay);

        $overlay.on("click", (e) => {
            if (this.$(e.target).hasClass("ws-dialog-overlay")) {
                this.removeDialog();
            }
        });
    }

    async showThemePreviewDialog(themeId) {
        this.removeDialog();
        try {
            const scriptUrl = new URL(import.meta.url);
            const basePath = scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/modules'));
            const themeUrl = `${basePath}/themes/sky/${themeId}.json`;
            const response = await fetch(themeUrl);
            if (!response.ok) throw new Error(`获取 ${themeId}.json 失败`);
            const themeData = await response.json();

            const $previewContainer = this.$('<div class="theme-preview-container"></div>');
            
            const gradients = themeData.gradients.filter(g => g.hour < 24);

            gradients.forEach(gradient => {
                const gradientCss = `linear-gradient(to bottom, ${gradient.colors[0]}, ${gradient.colors[1]})`;
                const $strip = this.$('<div class="theme-gradient-strip"></div>').css('background', gradientCss);
                $strip.append(`<span class="time-label">${String(gradient.hour).padStart(2, '0')}:00</span>`);
                $previewContainer.append($strip);
            });

            const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">关闭</button></div>');
            const dialog = this.createDialog(`预览: ${themeData.name}`, $previewContainer, buttons);
            dialog.find('.dialog_cancel').on('click', () => this.removeDialog());

        } catch (error) {
            console.error("Failed to show theme preview:", error);
            const content = this.$('<p>无法加载主题预览。</p>');
            const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">关闭</button></div>');
            const dialog = this.createDialog('错误', content, buttons);
            dialog.find('.dialog_cancel').on('click', () => this.removeDialog());
        }
    }

    createDialog(title, content, buttons, options = {}) {
        const data = this.state.latestWorldStateData || {};
        const theme = this.timeGradient.getThemeForTime({
            timeString: data['时间'] || '12:00',
            weatherString: data['天气'] || '晴',
            periodString: data['时段']
        });
        const themeClass = theme.brightness === 'light' ? 'theme-light-text' : 'theme-dark-text';

        const dialogClass = options.isMap ? 'tw-advanced-map-modal' : 'ws-dialog';

        const dialog = this.$(`<div class="ws-dialog-overlay ${themeClass}"><div class="${dialogClass}"><h3>${title}</h3><div class="dialog-content"></div><div class="dialog-buttons-wrapper"></div></div></div>`);
        
        dialog.find(`.${dialogClass}`).css('background', theme.background);

        dialog.find(".dialog-content").append(content);
        if (buttons) {
            dialog.find(".dialog-buttons-wrapper").append(buttons);
        }
        this.$("body").append(dialog);
        dialog.on("click", (event) => {
            if (this.$(event.target).hasClass("ws-dialog-overlay")) {
                this.removeDialog();
            }
        });
        return dialog;
    }

    removeDialog() {
        this.$(this.win.document).off('.twDialog');
        this.$(this.win.document).off('.tw_scroller');
        const overlay = this.$(".ws-dialog-overlay");
        if (overlay.length > 0) {
            overlay.addClass("closing");
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    }

    showMapEditorToolbox($container) {
        this.hideMapEditorToolbox(); 

        const $toolbox = this.$(`
            <div class="tw-map-editor-toolbox">
                <div class="tw-toolbox-header">
                    <button id="tw-create-node-btn" class="has-ripple">+ 创建新节点</button>
                </div>
                <div class="tw-toolbox-body">
                    <div class="tw-node-list-container">
                        <ul class="tw-map-node-tree"></ul>
                    </div>
                    <div class="tw-map-node-editor hidden">
                         <div class="tw-editor-field">
                            <label for="node-id">ID (不可更改)</label>
                            <input type="text" id="node-id" readonly>
                        </div>
                        <div class="tw-editor-field">
                            <label for="node-name">名称</label>
                            <input type="text" id="node-name" data-prop="name">
                        </div>
                        <div class="tw-editor-field">
                            <label for="node-parent">父节点ID (留空则为顶级节点)</label>
                            <input type="text" id="node-parent" data-prop="parentId">
                        </div>
                        <div class="tw-editor-field">
                            <label for="node-type">类型 (例如: region, city)</label>
                            <input type="text" id="node-type" data-prop="type">
                        </div>
                        <div class="tw-editor-field coords-field">
                            <label for="node-coords">坐标 (x,y)</label>
                            <div class="coords-input-wrapper">
                                <input type="text" id="node-coords" data-prop="coords" placeholder="未设置">
                                <button class="tw-clear-coords-btn has-ripple" title="清除坐标">✖</button>
                            </div>
                        </div>
                        <div class="tw-editor-field">
                            <label for="node-desc">描述</label>
                            <textarea id="node-desc" data-prop="description"></textarea>
                        </div>
                        <div class="tw-editor-field">
                            <label for="node-illustration">插图 (文件名)</label>
                            <input type="text" id="node-illustration" data-prop="illustration" placeholder="e.g., my_image.png">
                        </div>
                        <div class="tw-editor-field">
                            <label for="node-status">状态</label>
                            <select id="node-status" data-prop="status">
                                <option value="">无</option>
                                <option value="safe">安全</option>
                                <option value="danger">危险</option>
                                <option value="quest">任务</option>
                                <option value="cleared">已肃清</option>
                                <option value="locked">已锁定</option>
                            </select>
                        </div>
                        <div class="tw-map-editor-footer">
                            <button class="tw-delete-node-btn has-ripple">删除节点</button>
                        </div>
                    </div>
                    <!-- NEW SECTION FOR GLOBAL MAP SETTINGS -->
                    <div class="tw-map-global-settings">
                        <div class="tw-map-global-settings-divider"></div>
                        <div class="tw-editor-field">
                            <label for="tw-map-bg-url">地图背景图片 URL</label>
                            <input type="text" id="tw-map-bg-url" placeholder="粘贴完整的图片 URL">
                        </div>
                        <button id="tw-set-map-bg-btn" class="has-ripple">设置背景</button>
                    </div>
                </div>
            </div>
        `);

        $container.prepend($toolbox);
        this._renderAndAttachNodeTree($toolbox.find('.tw-map-node-tree'));
    }

    hideMapEditorToolbox() {
        this.$('.tw-map-editor-toolbox').remove();
    }
    
    _renderAndAttachNodeTree($treeContainer) {
        $treeContainer.empty();
        const { nodes } = this.mapSystem.mapDataManager;
        const nodeMap = new Map(Array.from(nodes.values()).map(node => [node.id, { ...node, children: [] }]));
        const roots = [];

        nodeMap.forEach(node => {
            if (node.parentId && nodeMap.has(node.parentId)) {
                nodeMap.get(node.parentId).children.push(node);
            } else {
                roots.push(node);
            }
        });

        const buildTreeHtml = (nodeList, depth) => {
            let html = '';
            nodeList.sort((a, b) => a.name.localeCompare(b.name));
            nodeList.forEach(node => {
                html += `<li class="tw-map-node-tree-item" data-node-id="${node.id}" style="--depth: ${depth};">${node.name}</li>`;
                if (node.children.length > 0) {
                    html += buildTreeHtml(node.children, depth + 1);
                }
            });
            return html;
        };

        $treeContainer.html(buildTreeHtml(roots, 0));
    }

    populateToolboxEditor(nodeId) {
        const $editor = this.$('.tw-map-node-editor');
        if (!$editor.length) return;
        
        const node = this.mapSystem.mapDataManager.nodes.get(nodeId);
        if (!node) {
            $editor.addClass('hidden');
            return;
        }

        $editor.removeClass('hidden');
        $editor.data('current-node-id', nodeId); // Store current node ID

        $editor.find('#node-id').val(node.id);
        $editor.find('#node-name').val(node.name || '');
        $editor.find('#node-parent').val(node.parentId || '');
        $editor.find('#node-type').val(node.type || '');
        $editor.find('#node-coords').val(node.coords || '');
        $editor.find('#node-desc').val(node.description || '');
        $editor.find('#node-illustration').val(node.illustration || '');
        $editor.find('#node-status').val(node.status || '');
    }
}