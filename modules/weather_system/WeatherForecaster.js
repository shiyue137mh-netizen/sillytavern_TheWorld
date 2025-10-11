
/**
 * The World - Weather Forecaster
 * @description Generates weather forecasts based on a two-layer probabilistic model.
 */
export class WeatherForecaster {
    constructor({ logger, state, helper }) {
        this.logger = logger;
        this.state = state;
        this.helper = helper; // TavernHelper for variable access
        this.patterns = new Map();
        this.STATE_VAR_NAME = 'tw_weather_system_state';
    }

    async loadPatterns() {
        this.logger.log('[WeatherForecaster] Loading weather patterns...');
        try {
            const scriptUrl = new URL(import.meta.url);
            const basePath = scriptUrl.pathname.substring(0, scriptUrl.pathname.lastIndexOf('/modules'));
            const patternUrl = `${basePath}/themes/weather/default.json`;
            const response = await fetch(patternUrl);
            if (!response.ok) throw new Error(`Failed to fetch default weather pattern: ${response.statusText}`);
            const patternData = await response.json();
            this.patterns.set(patternData.season_id, patternData);
            this.logger.success(`[WeatherForecaster] Loaded weather pattern: ${patternData.season_id}`);
        } catch (error) {
            this.logger.error('[WeatherForecaster] Failed to load weather patterns:', error);
        }
    }

    _getTimeSlot(decimalHour) {
        if (decimalHour >= 4 && decimalHour < 12) return "清晨";
        if (decimalHour >= 12 && decimalHour < 20) return "午后";
        return "夜晚";
    }

    _performWeightedRandom(options, key = 'system') {
        const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
        let random = Math.random() * totalWeight;
        for (const option of options) {
            if (random < option.weight) {
                return option[key];
            }
            random -= option.weight;
        }
        return options[0]?.[key]; // Fallback
    }

    async generateForecast() {
        const worldState = this.state.latestWorldStateData;
        if (!worldState) return '[天气预报]\n数据不足，无法生成预报。';

        const currentSeason = worldState['季节'] ? 'temperate_spring' : 'temperate_spring'; // Default for now
        const pattern = this.patterns.get(currentSeason);
        if (!pattern) return `[天气预报]\n未找到“${currentSeason}”季节的天气模式。`;

        // 1. Get current macro system state from chat variables
        let systemState = this.helper.getVariables({ type: 'chat' })[this.STATE_VAR_NAME];

        // 2. Initialize if it doesn't exist
        if (!systemState || typeof systemState !== 'object') {
            systemState = {
                system: pattern.base_system,
                duration: this._getRandomDuration(pattern.transitions.find(t => t.from === pattern.base_system)),
                elapsed: 0
            };
        }

        // 3. Generate the sequence of macro systems for the next 48 hours (6 slots)
        const macroForecast = [];
        let tempState = { ...systemState };

        for (let i = 0; i < 6; i++) {
            tempState.elapsed++;
            if (tempState.elapsed > tempState.duration) {
                // Transition to a new system
                const transitionRule = pattern.transitions.find(t => t.from === tempState.system);
                if (transitionRule) {
                    const nextSystem = this._performWeightedRandom(transitionRule.to, 'system');
                    const nextSystemRule = pattern.transitions.find(t => t.from === nextSystem);
                    
                    tempState = {
                        system: nextSystem,
                        duration: this._getRandomDuration(nextSystemRule),
                        elapsed: 1
                    };
                }
            }
            macroForecast.push(tempState.system);
        }
        
        // 4. Update the persistent state with the final state of our simulation
        this.helper.insertOrAssignVariables({ [this.STATE_VAR_NAME]: tempState }, { type: 'chat' });
        
        // 5. Generate micro weather conditions based on the macro forecast
        const microForecast = [];
        const timeMatch = (worldState['时间'] || '').match(/(\d{1,2}):(\d{2})/);
        let forecastHour = timeMatch ? parseInt(timeMatch[1], 10) + parseInt(timeMatch[2], 10) / 60 : 12;
        let forecastDate = new Date();

        for (const systemName of macroForecast) {
            forecastHour += 8;
             if (forecastHour >= 24) {
                forecastHour -= 24;
                forecastDate.setDate(forecastDate.getDate() + 1);
            }
            
            const systemDetails = pattern.systems[systemName];
            if (systemDetails && systemDetails.allowed_weathers) {
                const weather = this._performWeightedRandom(systemDetails.allowed_weathers, 'weather');
                microForecast.push({
                    date: new Date(forecastDate),
                    hour: forecastHour,
                    weather: weather
                });
            } else {
                 microForecast.push({
                    date: new Date(forecastDate),
                    hour: forecastHour,
                    weather: systemName // Fallback
                });
            }
        }

        return this.formatForecast(microForecast, worldState);
    }
    
    _getRandomDuration(rule) {
        if (!rule) return 3; // Default duration
        return Math.floor(Math.random() * (rule.max_slots - rule.min_slots + 1)) + rule.min_slots;
    }
    
    formatForecast(forecastData, currentWorldState) {
        let output = '[天气预报]\n';
        const today = new Date();
        const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
        const dayAfter = new Date(); dayAfter.setDate(today.getDate() + 2);

        const dayLabels = new Map();
        dayLabels.set(today.toDateString(), '今天');
        dayLabels.set(tomorrow.toDateString(), '明天');
        dayLabels.set(dayAfter.toDateString(), '后天');

        const timeMatch = (currentWorldState['时间'] || '').match(/(\d{1,2}):(\d{2})/);
        const currentHour = timeMatch ? parseInt(timeMatch[1], 10) + parseInt(timeMatch[2], 10) / 60 : 12;
        const currentSlot = this._getTimeSlot(currentHour);
        const currentTimeRange = currentSlot === "清晨" ? "04:00-11:59" : currentSlot === "午后" ? "12:00-19:59" : "20:00-03:59";
        
        output += `今天 - ${currentSlot} (${currentTimeRange}): ${currentWorldState['天气']}\n`;

        // We show 6 slots starting from the *next* one
        forecastData.slice(0, 6).forEach((item, index) => {
            const dayLabel = dayLabels.get(item.date.toDateString()) || item.date.toLocaleDateString();
            const timeSlot = this._getTimeSlot(item.hour);
            const timeRange = timeSlot === "清晨" ? "04:00-11:59" : timeSlot === "午后" ? "12:00-19:59" : "20:00-03:59";
            
            const label = `${dayLabel} - ${timeSlot} (${timeRange})`;
            output += `${label}: ${item.weather}\n`;
        });

        return output.trim();
    }
}
