/**
 * The World - Dynamic Time Gradient Color Engine
 * @description A utility to calculate sky gradients based on time of day.
 * V5: Refactored interpolation logic to be more robust and handle time wrapping correctly.
 * V6: Refactored getThemeForTime to prioritize timeString parsing and use periodString as a fallback.
 */
export class TimeGradient {
    constructor() {
        this.skyGradients = [];
        this.periodOverrides = {};
    }

    loadTheme(themeData) {
        if (themeData && Array.isArray(themeData.gradients) && themeData.gradients.length > 0) {
            this.skyGradients = themeData.gradients.sort((a, b) => a.hour - b.hour);
            this.periodOverrides = themeData.periodOverrides || {};
        } else {
            console.error("[TimeGradient] Invalid or empty theme loaded.");
            this.skyGradients = [{ hour: 0, colors: ['#555', '#222'], brightness: 'dark' }];
            this.periodOverrides = {};
        }
    }

    _hexToRgb(hex) {
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    }

    _rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0');
    }

    _interpolateColor(color1, color2, factor) {
        const rgb1 = this._hexToRgb(color1);
        const rgb2 = this._hexToRgb(color2);
        if (!rgb1 || !rgb2) return color1;
        const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
        const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
        const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));
        return this._rgbToHex(r, g, b);
    }

    _parseTimeToDecimal(timeString) {
        if (!timeString) return null;

        const hhmmMatch = timeString.match(/(\d{1,2}):(\d{2})/);
        if (hhmmMatch) {
            const hours = parseInt(hhmmMatch[1], 10);
            const minutes = parseInt(hhmmMatch[2], 10);
            return hours + minutes / 60;
        }

        const periodMap = {
            '子时': 23.5, '丑时': 1.5, '寅时': 3.5, '卯时': 5.5, '辰时': 7.5, '巳时': 9.5,
            '午时': 11.5, '未时': 13.5, '申时': 15.5, '酉时': 17.5, '戌时': 19.5, '亥时': 21.5,
            '午夜': 0, '深夜': 2, '黎明': 5, '清晨': 6, '日出': 6.5, '早上': 8, '上午': 10,
            '中午': 12, '正午': 12, '下午': 15, '黄昏': 18, '日落': 18.5, '傍晚': 19,
            '晚上': 21, '夜晚': 22, '白天': 12,
        };
        for (const period in periodMap) {
            if (timeString.includes(period)) {
                return periodMap[period];
            }
        }
        
        return null;
    }
    
    _derivePeriodFromTime(decimalHour) {
        if (decimalHour >= 22 || decimalHour < 4) return '夜晚';
        if (decimalHour >= 4 && decimalHour < 6) return '日出';
        if (decimalHour >= 6 && decimalHour < 9) return '清晨';
        if (decimalHour >= 9 && decimalHour < 17) return '白天';
        if (decimalHour >= 17 && decimalHour < 19) return '黄昏';
        if (decimalHour >= 19 && decimalHour < 22) return '夜晚';
        return '白天';
    }
    
    getThemeForTime({ timeString, weatherString, periodString }) {
        if (this.skyGradients.length === 0) {
            return { background: 'linear-gradient(#555, #222)', brightness: 'dark', period: '未知' };
        }

        const isBadWeather = weatherString && (weatherString.includes('雨') || weatherString.includes('雪') || weatherString.includes('阴') || weatherString.includes('雷'));
        
        // Attempt to parse a decimal hour from the time string.
        let decimalHour = this._parseTimeToDecimal(timeString);

        // --- PATH 1: Time was successfully parsed ---
        if (decimalHour !== null) {
            const definitivePeriod = periodString || this._derivePeriodFromTime(decimalHour);
            
            if (isBadWeather) {
                const badWeatherThemes = {
                    '夜晚': { colors: ['#1a1a1a', '#0a0a0a'], brightness: 'dark' },
                    '黄昏': { colors: ['#3a3a5a', '#2a2a3a'], brightness: 'dark' },
                    '日落': { colors: ['#3a3a5a', '#2a2a3a'], brightness: 'dark' },
                    '日出': { colors: ['#3a3a5a', '#2a2a3a'], brightness: 'dark' },
                    '黎明': { colors: ['#3a3a5a', '#2a2a3a'], brightness: 'dark' },
                    '清晨': { colors: ['#3a3a5a', '#2a2a3a'], brightness: 'dark' },
                    '白天': { colors: ['#6c757d', '#495057'], brightness: 'dark' }
                };
                const theme = badWeatherThemes[definitivePeriod] || badWeatherThemes['白天'];
                return { background: `linear-gradient(160deg, ${theme.colors[0]}, ${theme.colors[1]})`, brightness: theme.brightness, period: definitivePeriod };
            }

            if (decimalHour >= 24) decimalHour %= 24;

            const extendedGradients = [...this.skyGradients];
            const firstPoint = this.skyGradients[0];
            if (firstPoint.hour === 0 && !this.skyGradients.some(p => p.hour === 24)) {
                extendedGradients.push({ ...firstPoint, hour: 24 });
            }

            let start, end;
            for (let i = 0; i < extendedGradients.length - 1; i++) {
                if (decimalHour >= extendedGradients[i].hour && decimalHour < extendedGradients[i + 1].hour) {
                    start = extendedGradients[i];
                    end = extendedGradients[i + 1];
                    break;
                }
            }
            if (!start) {
                start = end = extendedGradients[extendedGradients.length - 1] || this.skyGradients[0];
            }

            const factor = (end.hour - start.hour > 0) ? (decimalHour - start.hour) / (end.hour - start.hour) : 0;
            const grad_start = this._interpolateColor(start.colors[0], end.colors[0], factor);
            const grad_end = this._interpolateColor(start.colors[1], end.colors[1], factor);
            
            return {
                background: `linear-gradient(160deg, ${grad_start}, ${grad_end})`,
                brightness: start.brightness,
                period: definitivePeriod
            };
        }

        // --- PATH 2: Time could NOT be parsed. Use periodString as the final fallback ("last line of defense"). ---
        const definitivePeriod = periodString || '白天';

        if (this.periodOverrides[definitivePeriod]) {
            const override = this.periodOverrides[definitivePeriod];
            return { background: `linear-gradient(160deg, ${override.colors[0]}, ${override.colors[1]})`, brightness: override.brightness, period: definitivePeriod };
        }

        if (isBadWeather && this.periodOverrides['默认恶劣天气']) {
            const override = this.periodOverrides['默认恶劣天气'];
            return { background: `linear-gradient(160deg, ${override.colors[0]}, ${override.colors[1]})`, brightness: override.brightness, period: definitivePeriod };
        }

        // Absolute last resort: default to a noon-like theme, but keep the period name.
        const fallbackPoint = this.skyGradients.find(p => p.hour === 12) || this.skyGradients[0];
        return { background: `linear-gradient(160deg, ${fallbackPoint.colors[0]}, ${fallbackPoint.colors[1]})`, brightness: fallbackPoint.brightness, period: definitivePeriod };
    }
}