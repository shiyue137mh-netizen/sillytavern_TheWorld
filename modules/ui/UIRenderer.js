/**
 * The World - UI Renderer
 * @description Responsible for generating HTML content for the UI panes.
 */
import { HOLIDAY_DATA } from '../utils/holidays.js';

export class UIRenderer {
    constructor({ $, config, state, skyThemeController, mapSystem, logger }) {
        this.$ = $;
        this.config = config;
        this.state = state;
        this.skyThemeController = skyThemeController;
        this.mapSystem = mapSystem; // For direct access to map data
        this.logger = logger;
    }

    getWeatherIconHtml(weather, period) {
        const container = (iconHtml) => `<div class="tw-weather-icon">${iconHtml}</div>`;

        if (weather.includes('雷')) {
            return container(`<div class="icon thunder-storm"><div class="cloud"></div><div class="lightning"><div class="bolt"></div><div class="bolt"></div></div></div>`);
        }
        if (weather.includes('雨')) {
             if (weather.includes('晴')) {
                return container(`<div class="icon sun-shower"><div class="cloud"></div><div class="sun"><div class="rays"></div></div><div class="rain"></div></div>`);
             }
             return container(`<div class="icon rainy"><div class="cloud"></div><div class="rain"></div></div>`);
        }
        if (weather.includes('雪')) {
            return container(`<div class="icon flurries"><div class="cloud"></div><div class="snow"><div class="flake"></div><div class="flake"></div></div></div>`);
        }
        if (weather.includes('云') || weather.includes('阴')) {
            return container(`<div class="icon cloudy"><div class="cloud"></div><div class="cloud"></div></div>`);
        }
        if (weather.includes('晴') || period.includes('白天')) {
            return container(`<div class="icon sunny"><div class="sun"><div class="rays"></div></div></div>`);
        }
        if (weather.includes('星') || period.includes('夜')) {
            // A simple moon icon representation using cloud styles
            return container(`<div class="icon sunny"><div class="sun" style="color: #f0e68c; box-shadow: 0 0 0 0.375em #f0e68c88;"><div class="rays" style="background:transparent; box-shadow:none;"></div></div></div>`);
        }

        // Fallback to emoji for unhandled weather
        let emoji = '🌦️';
        if (weather.includes('风')) emoji = '🌬️';
        else if (weather.includes('雾')) emoji = '🌫️';
        else if (weather.includes('樱')) emoji = '🌸';
        else if (weather.includes('流星')) emoji = '🌠';
        else if (weather.includes('萤火')) emoji = '✨';

        return `<span class="weather-emoji">${emoji}</span>`;
    }

    renderWorldStatePane($pane, data) {
        if (!data) {
            $pane.html('<p class="tw-notice">等待世界状态数据...</p>');
            return;
        }

        const period = data['时段'] || '白天';
        const weather = data['天气'] || '';
        const timeString = data['时间'] || '2024年01月01日-00:00';
        const seasonStr = data['季节'] || (timeString.match(/(春|夏|秋|冬)/) || [])[0];

        // New Time Parsing Logic
        const modernRegex = /(\d{4})[年-]?.*?(\d{1,2})[月-]?(\d{1,2})[日-]?.*?(\d{2}:\d{2})/;
        const fantasyRegex = /(\d{1,2}:\d{2})/;
        const modernMatch = timeString.match(modernRegex);
        const fantasyMatch = timeString.match(fantasyRegex);

        let timeHtml;
        let weekdayHtml = '';
        let holidayHtml = '';

        if (modernMatch) {
            const [, year, month, day, time] = modernMatch;
            const date = new Date(year, month - 1, day);
            const weekday = `星期${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`;
            weekdayHtml = `<div class="ws-weekday">${weekday}</div>`;

            const holidayKey = `${month}-${day}`;
            if (HOLIDAY_DATA[holidayKey]) {
                const holiday = HOLIDAY_DATA[holidayKey];
                holidayHtml = `<div class="ws-holiday-display">${holiday.icon} ${holiday.name}</div>`;
            }

            const [hour, minute] = time.split(':');
            timeHtml = `
                <div class="ws-time-main" id="tw-time-display-main">${hour}<span>:${minute}</span></div>
                <div class="ws-time-secondary">
                    <div class="ws-date-full">${year} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}</div>
                    ${weekdayHtml}
                </div>
            `;
        } else if (fantasyMatch) {
            const time = fantasyMatch[1];
            const datePart = timeString.replace(time, '').trim().replace(/,$/, '').trim();
            const [hour, minute] = time.split(':');
            timeHtml = `
                <div class="ws-time-main" id="tw-time-display-main">${hour}<span>:${minute}</span></div>
                <div class="ws-time-secondary">
                    <div class="ws-date-full-single">${datePart}</div>
                </div>
            `;
        } else {
            timeHtml = `<div class="ws-time-secondary"><div class="ws-date-full-single" id="tw-time-display-main">${timeString}</div></div>`;
        }
        
        const weatherIconHtml = this.getWeatherIconHtml(weather, period);

        let seasonIcon = '📅';
        if (seasonStr) {
            if (seasonStr.includes('春')) seasonIcon = '🌸';
            else if (seasonStr.includes('夏')) seasonIcon = '🏖️';
            else if (seasonStr.includes('秋')) seasonIcon = '🍁';
            else if (seasonStr.includes('冬')) seasonIcon = '⛄️';
        }
        
        const contentHtml = `
            <div class="ws-details">
                ${weatherIconHtml}
                <div class="ws-time-interact" title="改变时间">
                    <div class="ws-time-display">
                        ${timeHtml}
                    </div>
                </div>
                <div class="ws-weather-interact" title="改变天气">
                    <div class="ws-right">
                        <div class="ws-summary">${period}</div>
                        <div class="ws-date">${weather}</div>
                    </div>
                </div>
            </div>
            <div class="ws-content-inner">
                <hr class="ws-separator">
                <div class="ws-secondary-info">
                     ${(seasonStr ? `<div class="ws-info-block"><span class="ws-label">${seasonIcon} 季节:</span><span class="ws-value">${seasonStr}</span></div>` : '')}
                     ${holidayHtml}
                </div>
                ${(data['场景'] ? `<div class="ws-info-block ws-scene-block"><span class="ws-label">🏞️ 场景:</span><div class="ws-value">${(data['场景'] || '').replace(/\[\[(.*?)\]\]/g, '<span class="ws-interactive-keyword" data-keyword="$1">$1</span>')}</div></div>` : '')}
                ${(data['插图'] ? `<div class="ws-illustration-item"><a href="${this.config.IMAGE_BASE_URL}${data['插图']}" target="_blank" rel="noopener noreferrer"><img src="${this.config.IMAGE_BASE_URL}${data['插图']}" alt="${data['插图']}"></a></div>` : '')}
            </div>`;
        $pane.html(contentHtml);
    }

    async renderMapPane($pane) {
        $pane.empty();
        if (this.state.mapMode === 'lite') {
            this._renderLiteMapPane($pane);
        } else {
            await this._renderAdvancedMapPane($pane);
        }
    }

    _getNodeZoomThreshold(node) {
        if (node.zoomThreshold !== undefined && node.zoomThreshold !== null) {
            return Number(node.zoomThreshold);
        }
        // Default logic
        if (!node.parentId) return 0.2; // Top-level nodes always visible
        switch (node.type) {
            case 'region': return 0.5;
            case 'city': return 1.0;
            case 'landmark': return 1.5;
            case 'dungeon': return 1.5;
            default: return 1.2;
        }
    }

    async _renderAdvancedMapPane($pane) {
        const { mapDataManager, atlasManager } = this.mapSystem;

        const $mapContent = this.$('<div id="tw-advanced-map-content"></div>');
        $pane.append($mapContent);
        
        const $editButton = this.$('<button id="tw-map-edit-toggle-btn" class="has-ripple">编辑地图 ✏️</button>');
        $mapContent.append($editButton);

        if (!mapDataManager.isInitialized()) {
             const $placeholder = this.$(`
                <div class="tw-map-placeholder">
                    <p class="tw-notice">当前角色没有地图档案。</p>
                    <button id="tw-create-map-placeholder-btn" class="tw-create-map-button has-ripple">
                        <span class="button-icon">🗺️</span> 创建地图档案
                    </button>
                    <p class="tw-notice" style="font-size: 0.8em; opacity: 0.7; margin-top: 10px;">
                        或者，让AI在故事中通过 &lt;MapUpdate&gt; 标签自动创建。
                    </p>
                </div>`);
             $mapContent.append($placeholder);
             return;
        }

        const $viewport = this.$('<div class="tw-map-viewport"></div>');
        const $canvas = this.$('<div class="tw-map-canvas"></div>');
        
        // NEW: Smart background loading logic
        const globalBgUrl = await atlasManager.getBackgroundImage();
        if (globalBgUrl) {
            $canvas.css('background-image', `url(${globalBgUrl})`);
            this.logger.log(`[UIRenderer] Applied global map background from Atlas: ${globalBgUrl}`);
        }

        const $svgLayer = this.$(`<svg class="tw-map-lines-svg"></svg>`);
        const $sidebar = this.$('<div class="tw-map-sidebar"><h4>孤立节点</h4><p style="font-size:0.8em; opacity:0.7; padding: 0 10px;">拖拽到地图上以设置坐标。</p></div>');
        const $sidebarList = this.$('<ul class="tw-sidebar-list"></ul>');
        
        let hasUnplottedNodes = false;
        
        // Pre-calculate children for efficiency
        const nodesWithChildren = new Map();
        mapDataManager.nodes.forEach(node => {
            if (node.parentId && mapDataManager.nodes.has(node.parentId)) {
                if (!nodesWithChildren.has(node.parentId)) {
                    nodesWithChildren.set(node.parentId, []);
                }
                nodesWithChildren.get(node.parentId).push(node);
            }
        });
        
        mapDataManager.nodes.forEach(node => {
            if (node.coords) {
                const [x, y] = node.coords.split(',').map(Number);
                const zoomThreshold = this._getNodeZoomThreshold(node);

                const $pin = this.$('<div>')
                    .addClass('tw-map-pin')
                    .attr('data-node-id', node.id)
                    .attr('data-zoom-threshold', zoomThreshold)
                    .css({ left: `${x / 10}%`, top: `${y / 10}%` });
                
                const children = nodesWithChildren.get(node.id);
                if (children && children.length > 0) {
                    $pin.addClass('is-cluster-parent');
                    const minChildThreshold = Math.min(...children.map(child => this._getNodeZoomThreshold(child)));
                    $pin.attr('data-min-child-threshold', minChildThreshold);
                }

                if (node.parentId && mapDataManager.nodes.has(node.parentId)) {
                    $pin.addClass('is-child-node');
                } else {
                    $pin.addClass('is-parent-node');
                }

                const $pinLabel = this.$(`<div class="tw-map-pin-label">${node.name}</div>`);
                $pin.append($pinLabel);
                $canvas.append($pin);
            } else {
                 const $item = this.$(`<li class="tw-sidebar-item" data-node-id="${node.id}">${node.name}</li>`);
                 $sidebarList.append($item);
                 hasUnplottedNodes = true;
            }
        });

        $viewport.append($canvas, $svgLayer);
        
        if (hasUnplottedNodes) {
             $sidebar.append($sidebarList);
             $viewport.append($sidebar);
        }
        
        $mapContent.append($viewport);

        // Add zoom controls
        const $zoomControls = this.$(`
            <div class="tw-map-zoom-controls">
                <button class="tw-map-zoom-btn has-ripple" data-zoom-direction="in" title="放大">+</button>
                <button class="tw-map-zoom-btn has-ripple" data-zoom-direction="out" title="缩小">-</button>
            </div>
        `);
        $mapContent.append($zoomControls);
    }

    _renderLiteMapPane($pane) {
        $pane.css('padding', '15px'); // Add padding back for lite mode
        const { mapDataManager } = this.mapSystem;
        const { liteMapPathStack } = this.state;

        if (!mapDataManager.isInitialized()) {
             $pane.html(`
                <div class="tw-map-placeholder" style="padding:15px;">
                    <p class="tw-notice">当前角色没有地图档案。</p>
                    <button id="tw-create-map-placeholder-btn" class="tw-create-map-button has-ripple">
                        <span class="button-icon">🗺️</span> 创建地图档案
                    </button>
                    <p class="tw-notice" style="font-size: 0.8em; opacity: 0.7; margin-top: 10px;">
                        或者，让AI在故事中通过 &lt;MapUpdate&gt; 标签自动创建。
                    </p>
                </div>`);
             return;
        }

        // 1. Render Breadcrumbs
        const $breadcrumbs = this.$('<div class="tw-lite-map-breadcrumbs"></div>');
        $breadcrumbs.append('<span class="tw-lite-map-breadcrumb-item tw-lite-map-breadcrumb-item-root">世界</span>');
        
        liteMapPathStack.forEach((nodeId, index) => {
            const node = mapDataManager.nodes.get(nodeId);
            if (node) {
                const isCurrent = index === liteMapPathStack.length - 1;
                $breadcrumbs.append('<span>&nbsp;/&nbsp;</span>');
                $breadcrumbs.append(
                    `<span class="tw-lite-map-breadcrumb-item ${isCurrent ? 'current' : ''}" data-index="${index}">${node.name}</span>`
                );
            }
        });
        $pane.append($breadcrumbs);

        // 2. Render Node List
        const currentParentId = liteMapPathStack.length > 0 ? liteMapPathStack[liteMapPathStack.length - 1] : null;
        
        const children = Array.from(mapDataManager.nodes.values()).filter(node => {
            return (currentParentId === null && !node.parentId) || node.parentId === currentParentId;
        }).sort((a,b) => a.name.localeCompare(b.name));

        const $list = this.$('<ul class="tw-lite-map-list"></ul>');
        if (children.length === 0) {
            $list.append('<p class="tw-notice">这里空空如也。</p>');
        } else {
            children.forEach(node => {
                const hasChildren = this._nodeHasChildren(node.id);
                const $item = this.$(`
                    <li class="tw-lite-map-item" data-node-id="${node.id}">
                        <div class="tw-lite-map-item-name">
                            <span class="tw-lite-map-item-icon">${this._getNodeIcon(node)}</span>
                            <span>${node.name}</span>
                        </div>
                        ${hasChildren ? '<span class="tw-lite-map-item-children-indicator">▶</span>' : ''}
                    </li>
                `);
                $list.append($item);
            });
        }
        $pane.append($list);
    }

    _nodeHasChildren(nodeId) {
        for (const node of this.mapSystem.mapDataManager.nodes.values()) {
            if (node.parentId === nodeId) return true;
        }
        return false;
    }

    _getNodeIcon(node) {
        if (node.type) {
            if (node.type.toLowerCase() === 'region') return '🏞️';
            if (node.type.toLowerCase() === 'city') return '🏙️';
            if (node.type.toLowerCase() === 'dungeon') return '🦇';
            if (node.type.toLowerCase() === 'landmark') return '📍';
        }
        return '🌍'; // Default icon
    }
    
    renderSettingsPane($pane) {
        $pane.empty();

        const settingsContent = `
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>地图模式</h4>
                    <p>在简洁的列表视图和高级的画布视图之间切换。</p>
                </div>
                <div class="tw-map-mode-switch">
                    <button data-mode="lite" class="${this.state.mapMode === 'lite' ? 'active' : ''}">轻量模式</button>
                    <button data-mode="advanced" class="${this.state.mapMode === 'advanced' ? 'active' : ''}">高级模式</button>
                </div>
            </div>
            <hr class="ws-separator">
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>字体大小</h4>
                    <p>调整世界仪表盘内所有文本的字体大小。</p>
                </div>
                <div class="select-container">
                    <select id="font-size-select">
                        <option value="12px" ${this.state.fontSize === '12px' ? 'selected' : ''}>小</option>
                        <option value="14px" ${this.state.fontSize === '14px' ? 'selected' : ''}>默认</option>
                        <option value="16px" ${this.state.fontSize === '16px' ? 'selected' : ''}>中</option>
                        <option value="18px" ${this.state.fontSize === '18px' ? 'selected' : ''}>大</option>
                    </select>
                </div>
            </div>
            <hr class="ws-separator">
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>动态背景</h4>
                    <p>根据游戏内时间，将动态渐变色应用为酒馆背景。</p>
                </div>
                <div class="toggle-switch">
                    <input type="checkbox" id="global-theme-toggle" ${this.state.isGlobalThemeEngineEnabled ? 'checked' : ''}>
                    <label for="global-theme-toggle"></label>
                </div>
            </div>
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>沉浸模式</h4>
                    <p>让聊天界面变为半透明的“毛玻璃”效果，透出动态背景。 (需要“动态背景”开启)</p>
                </div>
                <div class="toggle-switch">
                    <input type="checkbox" id="immersive-mode-toggle" ${this.state.isImmersiveModeEnabled ? 'checked' : ''} ${!this.state.isGlobalThemeEngineEnabled ? 'disabled' : ''}>
                    <label for="immersive-mode-toggle"></label>
                </div>
            </div>
            <hr class="ws-separator">
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>开启音频</h4>
                    <p>启用或禁用所有环境音和音效。</p>
                </div>
                <div class="toggle-switch">
                    <input type="checkbox" id="audio-enabled-toggle" ${this.state.isAudioEnabled ? 'checked' : ''}>
                    <label for="audio-enabled-toggle"></label>
                </div>
            </div>
            <div class="settings-item">
                 <div class="settings-item-text">
                    <h4>环境音音量</h4>
                </div>
                <div class="slider-container" style="width: 150px;">
                    <input type="range" id="ambient-volume-slider" min="0" max="1" step="0.05" value="${this.state.ambientVolume}">
                    <span id="ambient-volume-value" class="slider-value">${Math.round(this.state.ambientVolume * 100)}%</span>
                </div>
            </div>
            <div class="settings-item">
                 <div class="settings-item-text">
                    <h4>音效音量</h4>
                </div>
                 <div class="slider-container" style="width: 150px;">
                    <input type="range" id="sfx-volume-slider" min="0" max="1" step="0.05" value="${this.state.sfxVolume}">
                    <span id="sfx-volume-value" class="slider-value">${Math.round(this.state.sfxVolume * 100)}%</span>
                </div>
            </div>
            <hr class="ws-separator">
             <div class="settings-item">
                <div class="settings-item-text">
                    <h4>全局天气特效</h4>
                    <p>让雨、雪等粒子效果在整个屏幕上显示，而不是仅在面板内。</p>
                </div>
                <div class="toggle-switch">
                    <input type="checkbox" id="fx-global-toggle" ${this.state.isFxGlobal ? 'checked' : ''}>
                    <label for="fx-global-toggle"></label>
                </div>
            </div>
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>显示雨滴特效</h4>
                    <p>在雨天时，模拟雨滴落在玻璃上的视觉效果。</p>
                </div>
                <div class="toggle-switch">
                    <input type="checkbox" id="raindrop-fx-toggle" ${this.state.isRaindropFxOn ? 'checked' : ''}>
                    <label for="raindrop-fx-toggle"></label>
                </div>
            </div>
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>天气粒子特效</h4>
                    <p>启用或禁用雨、雪、风等粒子效果。</p>
                </div>
                <div class="toggle-switch">
                    <input type="checkbox" id="weather-fx-toggle" ${this.state.weatherFxEnabled ? 'checked' : ''}>
                    <label for="weather-fx-toggle"></label>
                </div>
            </div>
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>3D云效</h4>
                    <p>启用或禁用动态的3D体积云效果。</p>
                </div>
                <div class="toggle-switch">
                    <input type="checkbox" id="cloud-fx-toggle" ${this.state.isCloudFxEnabled ? 'checked' : ''}>
                    <label for="cloud-fx-toggle"></label>
                </div>
            </div>
            <hr class="ws-separator">
             <div class="settings-item">
                <div class="settings-item-text">
                    <h4>天色主题</h4>
                    <p>选择一个预设的天空颜色方案。</p>
                </div>
            </div>
        `;
        $pane.append(settingsContent);

        const $themeList = this.$('<div class="theme-list"></div>');
        if (this.skyThemeController && this.skyThemeController.availableThemes) {
            this.skyThemeController.availableThemes.forEach(theme => {
                const isActive = this.state.activeSkyThemeId === theme.id;
                const $card = this.$(`
                    <div class="theme-card ${isActive ? 'active' : ''}" data-theme-id="${theme.id}">
                        <h4>${theme.name}</h4>
                        <p>作者: ${theme.author}</p>
                        <div class="theme-actions">
                            <button class="btn-preview has-ripple">预览</button>
                            <button class="btn-activate has-ripple">${isActive ? '当前' : '启用'}</button>
                        </div>
                    </div>
                `);
                $themeList.append($card);
            });
        }
        $pane.append($themeList);
        $pane.append('<hr class="ws-separator">');

        const managementContent = this.$(`
            <div>
                <div class="settings-item">
                    <div class="settings-item-text">
                        <h4>地图与数据</h4>
                    </div>
                </div>
                ${!this.mapSystem.mapDataManager.isInitialized() ? `
                    <div class="settings-item">
                        <div class="settings-item-text">
                            <p>为当前角色创建一个新的地图档案世界书。</p>
                        </div>
                        <button id="tw-create-map-btn" class="clear-data-btn has-ripple" style="border-color: #2ecc71; color: #2ecc71;">🗺️ 创建地图档案</button>
                    </div>
                ` : `
                    <div class="settings-item">
                        <div class="settings-item-text">
                            <p>地图档案已连接: <b>${this.mapSystem.mapDataManager.bookName}</b></p>
                        </div>
                    </div>
                `}
                <div class="settings-item">
                    <div class="settings-item-text">
                        <h4>数据存储</h4>
                        <p>清空此扩展在浏览器中存储的所有数据（包括设置和缓存）。</p>
                    </div>
                    <button id="clear-all-data-btn" class="clear-data-btn has-ripple">🗑️ 清空所有存储</button>
                </div>
                <div class="settings-item">
                   <div class="settings-item-text">
                       <h4>UI 管理</h4>
                        <p>如果面板被意外移出屏幕，此按钮可以将其复位到右上角。</p>
                   </div>
                   <button id="reset-ui-btn" class="clear-data-btn has-ripple">🔄️ 重置UI位置</button>
               </div>
            </div>
        `);
        $pane.append(managementContent);
    }
}