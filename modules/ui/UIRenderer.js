/**
 * The World - UI Renderer
 * @description Responsible for generating HTML content for the UI panes.
 */
export class UIRenderer {
    constructor({ $, config, state, skyThemeController }) {
        this.$ = $;
        this.config = config;
        this.state = state;
        this.skyThemeController = skyThemeController;
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
        const timeString = data['时间'] || '2024年01月01日-星期一-00:00';
        const seasonStr = data['季节'] || (timeString.match(/(春|夏|秋|冬)/) || [])[0];

        // New Time Parsing Logic
        const modernRegex = /(\d{4})[年-]?.*?(\d{1,2})[月-]?(\d{1,2})[日-]?.*?(星期.)?.*?(\d{2}:\d{2})/;
        const fantasyRegex = /(\d{1,2}:\d{2})/;
        const modernMatch = timeString.match(modernRegex);
        const fantasyMatch = timeString.match(fantasyRegex);

        let timeHtml;
        if (modernMatch) {
            const [, year, month, day, weekday, time] = modernMatch;
            const [hour, minute] = time.split(':');
            timeHtml = `
                <div class="ws-time-main" id="tw-time-display-main">${hour}<span>:${minute}</span></div>
                <div class="ws-time-secondary">
                    <div class="ws-date-full">${year} / ${String(month).padStart(2, '0')} / ${String(day).padStart(2, '0')}</div>
                    <div class="ws-weekday">${weekday || ''}</div>
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
                </div>
                ${(data['场景'] ? `<div class="ws-info-block ws-scene-block"><span class="ws-label">🏞️ 场景:</span><div class="ws-value">${(data['场景'] || '').replace(/\[\[(.*?)\]\]/g, '<span class="ws-interactive-keyword" data-keyword="$1">$1</span>')}</div></div>` : '')}
                ${(data['插图'] ? `<div class="ws-illustration-item"><a href="${this.config.IMAGE_BASE_URL}${data['插图']}" target="_blank" rel="noopener noreferrer"><img src="${this.config.IMAGE_BASE_URL}${data['插图']}" alt="${data['插图']}"></a></div>` : '')}
            </div>`;
        $pane.html(contentHtml);
    }

    renderMapNavigationPane($pane, mapData) {
        if (!mapData || !Array.isArray(mapData.locations)) {
            $pane.html('<p class="tw-notice">等待地图数据...</p>');
            return;
        }

        if (mapData.moveBlock) {
            $pane.append('<div class="move_block_notice">当前故事不允许自由移动</div>');
        }

        const $mainLocations = this.$('<div class="locations_container main_locations"></div>');
        mapData.locations.forEach(location => {
            $mainLocations.append(this.createLocationCard(location).addClass('main_location'));
        });
        $pane.append($mainLocations);

        mapData.locations.forEach(location => {
            const $subContainer = this.$(`<div class="locations_container sub_locations_container" data-main="${location.name}" style="display:none;"></div>`);
            if (Array.isArray(location.subLocations)) {
                location.subLocations.forEach(subLocation => {
                    $subContainer.append(this.createLocationCard(subLocation).addClass('sub_location'));
                });
            }
            $pane.append($subContainer);
        });

        $pane.append(this.$('<div class="map_action_area"><button class="go_button disabled has-ripple">前往</button></div>'));
    }

    createLocationCard(locationData) {
        const $card = this.$(`<div class="location_card" data-name="${locationData.name}"></div>`);
        if (locationData.bg) {
            $card.addClass("has-bg").css("background-image", `url(${this.config.IMAGE_BASE_URL}${locationData.bg})`);
        }
        if (locationData.travelTime) {
            $card.append(`<div class="travel_time">⏱️ ${locationData.travelTime}</div>`);
        }
        if (locationData.description) {
            $card.append(`<div class="location_echo" title="${locationData.description}">👁️</div>`);
        }
        let icon = '';
        for (const emoji in this.config.LOCATION_KEYWORD_ICONS) {
            if (this.config.LOCATION_KEYWORD_ICONS[emoji].some(keyword => locationData.name.includes(keyword))) {
                icon = `<span class="location_icon">${emoji}</span>`;
                break;
            }
        }
        $card.append(`<div class="location_name">${icon}${locationData.name}</div>`);
        if (locationData.characters && locationData.characters.length > 0) {
            const $charList = this.$('<div class="characters_list"></div>');
            locationData.characters.forEach(char => {
                let charIcon = '';
                for (const emoji in this.config.NPC_KEYWORD_ICONS) {
                    if (this.config.NPC_KEYWORD_ICONS[emoji].some(keyword => char.name.includes(keyword))) {
                        charIcon = `<span class="npc_icon">${emoji}</span>`;
                        break;
                    }
                }
                const $charName = this.$(`<span class="character_name interactive" data-name="${char.name}" title="${char.action || ''}">${charIcon}${char.name}</span>`);
                $charList.append($charName);
            });
            $card.append($charList);
        }
        return $card;
    }

    renderSettingsPane($pane) {
        // Clear previous content
        $pane.empty();

        // 1. Theme Selection Section
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
        const $themeSection = this.$(`
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>天色主题</h4>
                    <p>选择一个预设的天空颜色方案。</p>
                </div>
            </div>
        `).append($themeList);

        $pane.append($themeSection);
        $pane.append('<hr class="ws-separator">');

        // 2. Toggles and Buttons Section
        const otherSettingsContent = `
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
                    <h4>UI 管理</h4>
                     <p>如果面板被意外移出屏幕，此按钮可以将其复位到右上角。</p>
                </div>
                <button id="reset-ui-btn" class="clear-data-btn has-ripple">🔄️ 重置UI位置</button>
            </div>
            <div class="settings-item">
                <div class="settings-item-text">
                    <h4>数据管理</h4>
                    <p>清空此扩展在浏览器中存储的所有数据。</p>
                </div>
                <button id="clear-all-data-btn" class="clear-data-btn has-ripple">🗑️ 清空所有存储</button>
            </div>`;
        $pane.append(otherSettingsContent);
    }
}