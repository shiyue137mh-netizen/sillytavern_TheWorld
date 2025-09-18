/**
 * The World - Dynamic Time Gradient Color Engine
 * @description A utility to calculate sky gradients based on time of day.
 * V3: Refactored to use a centralized period determination logic for better consistency.
 */
export class TimeGradient {
    constructor() {
        this.skyGradients = [];
        this.periodOverrides = {};
    }

    loadTheme(themeData) {
        if (themeData && Array.isArray(themeData.gradients) && themeData.gradients.length > 0) {
            this.skyGradients = themeData.gradients;
            this.periodOverrides = themeData.periodOverrides || {};
        } else {
            console.error("[TimeGradient] Invalid or empty theme loaded.");
            this.skyGradients = [{ hour: 0, colors: ['#555', '#222'], brightness: 'dark' }, { hour: 24, colors: ['#555', '#222'], brightness: 'dark' }];
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
        const hhmmMatch = timeString.match(/(\d{1,2}):(\d{2})/);
        if (hhmmMatch) {
            const hours = parseInt(hhmmMatch[1], 10);
            const minutes = parseInt(hhmmMatch[2], 10);
            return hours + minutes / 60;
        }

        const periodMap = {
            '子时': 23.5, '丑时': 1.5, '寅时': 3.5, '卯时': 5.5, '辰时': 7.5, '巳时': 9.5, '午时': 11.5,
            '未时': 13.5, '申时': 15.5, '酉时': 17.5, '戌时': 19.5, '亥时': 21.5, '午夜': 0, '深夜': 2,
            '黎明': 5, '清晨': 6, '日出': 6.5, '早上': 8, '上午': 10, '中午': 12, '正午': 12, '下午': 15,
            '黄昏': 18, '日落': 18.5, '傍晚': 19, '晚上': 21, '夜晚': 22, '白天': 12,
        };
        for (const period in periodMap) { if (timeString.includes(period)) { return periodMap[period]; } }
        return 12; // Default to noon
    }
    
    _derivePeriodFromTime(decimalHour) {
        if (decimalHour >= 20 || decimalHour < 4) return '夜晚';
        if (decimalHour >= 4 && decimalHour < 5) return '日出';
        if (decimalHour >= 5 && decimalHour < 8) return '清晨';
        if (decimalHour >= 8 && decimalHour < 12) return '上午';
        if (decimalHour >= 12 && decimalHour < 14) return '中午';
        if (decimalHour >= 14 && decimalHour < 17) return '下午';
        if (decimalHour >= 17 && decimalHour < 18) return '日落';
        if (decimalHour >= 18 && decimalHour < 20) return '黄昏';
        return '白天';
    }
    
    /**
     * Determines the definitive time period based on a two-layer check.
     * Priority 1: Use the explicit '时段' (periodString) if available.
     * Priority 2: Infer the period from the '时间' (timeString) if the period is not provided.
     * @param {{timeString: string, periodString: string}} params - The time and period strings from the world state.
     * @returns {string} The determined time period (e.g., '夜晚', '清晨').
     */
    determineDefinitivePeriod({ timeString, periodString }) {
        if (periodString && periodString.trim() !== '') {
            return periodString.trim();
        }
        if (timeString) {
            const decimalHour = this._parseTimeToDecimal(timeString);
            return this._derivePeriodFromTime(decimalHour);
        }
        return '白天'; // Fallback
    }

    getThemeForTime({ timeString, weatherString, periodString }) {
        if (this.skyGradients.length === 0) {
            return { background: 'linear-gradient(#555, #222)', brightness: 'dark', period: '未知' };
        }
        
        const definitivePeriod = this.determineDefinitivePeriod({ timeString, periodString });
        const isBadWeather = weatherString && (weatherString.includes('雨') || weatherString.includes('雪') || weatherString.includes('阴') || weatherString.includes('雷'));

        if (this.periodOverrides[definitivePeriod]) {
            const override = this.periodOverrides[definitivePeriod];
            return { background: `linear-gradient(160deg, ${override.colors[0]}, ${override.colors[1]})`, brightness: override.brightness, period: definitivePeriod };
        }
        
        if (isBadWeather && this.periodOverrides['默认恶劣天气']) {
            const override = this.periodOverrides['默认恶劣天气'];
            return { background: `linear-gradient(160deg, ${override.colors[0]}, ${override.colors[1]})`, brightness: override.brightness, period: definitivePeriod };
        }

        let colorDecimalHour = this._parseTimeToDecimal(timeString || '12:00');
        if (colorDecimalHour === 24) colorDecimalHour = 0;

        let start, end;
        for (let i = 0; i < this.skyGradients.length - 1; i++) {
            if (colorDecimalHour >= this.skyGradients[i].hour && colorDecimalHour < this.skyGradients[i + 1].hour) {
                start = this.skyGradients[i];
                end = this.skyGradients[i + 1];
                break;
            }
        }
        
        if (!start || !end) {
            start = this.skyGradients[this.skyGradients.length - 2] || this.skyGradients[0];
            end = this.skyGradients[this.skyGradients.length - 1] || this.skyGradients[0];
        }

        const factor = (end.hour - start.hour > 0) ? (colorDecimalHour - start.hour) / (end.hour - start.hour) : 0;
        const grad_start = this._interpolateColor(start.colors[0], end.colors[0], factor);
        const grad_end = this._interpolateColor(start.colors[1], end.colors[1], factor);
        const baseGradient = `linear-gradient(160deg, ${grad_start}, ${grad_end})`;
        const finalBrightness = (start.brightness === 'light' && factor < 0.7) || (end.brightness === 'light' && factor > 0.3) ? 'light' : 'dark';

        return { background: baseGradient, brightness: finalBrightness, period: definitivePeriod };
    }
}
