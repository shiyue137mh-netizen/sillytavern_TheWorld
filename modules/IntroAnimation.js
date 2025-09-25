/**
 * The World - Intro Animation
 * @description Handles the one-time intro animation on first load with dynamic effects.
 */
import { Clouds3dFX } from './weather_system/effects/complex/clouds_3d.js';

export class IntroAnimation {
    constructor({ $, injectionEngine, timeGradient, state, logger, dataManager, win }) {
        this.$ = $;
        this.injectionEngine = injectionEngine;
        this.timeGradient = timeGradient;
        this.state = state;
        this.logger = logger;
        this.dataManager = dataManager;
        this.win = win; // Save the window object
        this.clouds = null;
        this.animState = null;
        this._animationTimeouts = [];
        this._resolvePromise = null;
    }

    _cleanupAndResolve() {
        if (!this._resolvePromise) return; // Prevent multiple calls

        this.logger.log('[世界] 正在清理加载动画资源...');
        
        this._animationTimeouts.forEach(clearTimeout);
        this._animationTimeouts = [];

        if (this.animState && this.animState.frameId) {
            cancelAnimationFrame(this.animState.frameId);
            this.animState.frameId = null;
        }

        if (this.clouds) {
            this.clouds.deactivate();
            this.clouds = null;
        }

        const $overlay = this.$('#tw-custom-loader-overlay');
        if ($overlay.length) {
            $overlay.css('opacity', '0');
            setTimeout(() => {
                $overlay.remove();
                this.injectionEngine.removeCss('the-world-loader-style');
            }, 1500);
        } else {
             this.injectionEngine.removeCss('the-world-loader-style');
        }

        this.state.hasLoadedBefore = true;
        this.dataManager.saveState();
        
        this._resolvePromise();
        this._resolvePromise = null; // Mark as resolved
    }

    run() {
        return new Promise((resolve) => {
            // NEW: Check for mobile view and skip animation if detected
            const isMobile = this.win.innerWidth <= 768;
            if (isMobile || this.state.hasLoadedBefore) {
                this.logger.log(`[世界] ${isMobile ? '移动端视图，' : ''}${this.state.hasLoadedBefore ? '非首次加载，' : ''}跳过介绍动画。`);
                // Ensure state is set correctly even when skipping
                this.state.hasLoadedBefore = true;
                this.dataManager.saveState();
                resolve();
                return;
            }
            
            this._resolvePromise = resolve;

            this._animationTimeouts.push(setTimeout(() => {
                this.logger.log('[世界] 首次加载，创建诗歌加载动画...');
                
                const animationTotalDuration = 37500;
                const poemsDuration = 30000;
                const poetryFadeDuration = 7500;

                const $overlay = this.$('<div>').attr('id', 'tw-custom-loader-overlay');
                
                const newLoaderCSS = `
                    @import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css");
                    #preloader { display: none !important; }
                    #tw-custom-loader-overlay {
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                        z-index: 999999 !important;
                        display: flex; flex-direction: column;
                        align-items: center; justify-content: center;
                        background-color: #000;
                        transition: opacity 1.5s ease-in-out;
                        opacity: 0; /* Start transparent for fade-in */
                        overflow: hidden;
                        font-family: "Georgia", "Times New Roman", "SimSun", "STSong", serif;
                    }
                    .tw-loader-bg-layer {
                        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                        opacity: 0; transition: opacity 5s ease-in-out;
                        background-size: 200% 200%;
                        animation: bg-pan-loader 90s linear infinite alternate;
                    }
                    @keyframes bg-pan-loader { from { background-position: 0% 0%; } to { background-position: 100% 100%; } }
                    
                    .tw-loader-poetry-container {
                        position: relative; width: 80%; max-width: 700px; height: 250px;
                        text-align: center;
                        z-index: 10;
                        transition: color 1s ease-in-out, opacity 1s ease-out;
                        color: #e2e8f0; /* Default dark text */
                    }
                    .poem-wrapper {
                        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                        display: flex; flex-direction: column;
                        align-items: center; justify-content: center;
                        opacity: 0;
                        animation: fade-in-out-poem ${poetryFadeDuration}ms ease-in-out forwards;
                    }
                    .poem-line { margin: 0.2em 0; line-height: 1.7; text-shadow: 0 1px 4px rgba(0,0,0,0.7); }
                    .poem-original { font-size: 1.2em; color: inherit; font-weight: 400; }
                    .poem-translation { font-size: 1em; opacity: 0.7; font-style: italic; }
                    .poem-attribution { width: 100%; text-align: right; margin-top: 2em; padding-right: 1em; font-size: 0.8em; opacity: 0.5; }
                    .tw-loader-poetry-container.theme-light-text { color: #2D3748; }
                    .tw-loader-poetry-container.theme-light-text .poem-line { text-shadow: 0 1px 2px rgba(255,255,255,0.4); }

                    .tw-loader-brand-container {
                        position: absolute; text-align: center; z-index: 20;
                        opacity: 0; transition: opacity 2s ease-in-out;
                    }
                    .tw-loader-title { font-size: 3.5em; font-weight: 700; letter-spacing: 0.1em; text-shadow: 0 2px 10px rgba(0,0,0,0.5); color: #fff;}
                    .tw-loader-subtitle { font-size: 1.2em; font-style: italic; margin-top: 0.5em; opacity: 0.8; color: #fff;}
                    .tw-loader-credits {
                        position: fixed; bottom: 20px;
                        display: flex; align-items: center; gap: 15px;
                        font-size: 0.9em; color: #aaa; opacity: 0; z-index: 20;
                        animation: fade-in-skip 1s ease-in-out 31s forwards;
                    }
                    .tw-loader-credits a { color: inherit; text-decoration: none; display:contents; }
                    .tw-loader-credits i { font-size: 1.3em; transition: color 0.3s; }
                    .tw-loader-credits a:hover i { color: #fff; }
                    
                    .tw-loader-skip-btn {
                        position: fixed; bottom: 20px; right: 20px;
                        background: none; border: none; color: rgba(255, 255, 255, 0.5);
                        font-family: sans-serif; font-size: 14px; cursor: pointer;
                        z-index: 100; opacity: 0; animation: fade-in-skip 1s ease-in-out 3s forwards;
                    }
                    .tw-loader-skip-btn:hover { color: rgba(255, 255, 255, 0.9); }
                    @keyframes fade-in-skip { to { opacity: 1; } }

                    .tw-loader-star {
                        position: absolute; border-radius: 50%; background-color: #fff;
                        animation: twinkle-loader 4s infinite;
                        transition: opacity 2s ease-out; z-index: 0;
                    }
                    @keyframes twinkle-loader { 50% { opacity: 0.3; } }

                    .tw-bird-container-loader {
                        position: absolute; top: 20%; left: -10%;
                        transform: scale(0.6) translateX(-10vw); will-change: transform;
                        animation-timing-function: linear; animation-iteration-count: 1;
                        z-index: 1;
                        animation-name: tw-fly-path-loader-1; animation-duration: 20s;
                    }
                    .tw-bird-loader {
                        background-image: url(${this.injectionEngine.win.location.origin}/scripts/extensions/The%20World/the_world/assets/images/bird-cells-new.svg);
                        background-size: auto 100%; width: 88px; height: 125px;
                        will-change: background-position;
                        animation: tw-fly-cycle-loader 1s steps(10) -0.5s infinite;
                    }
                    @keyframes tw-fly-cycle-loader { 100% { background-position: -880px 0; } }
                    @keyframes tw-fly-path-loader-1 {
                        0% { transform: scale(0.6) translateX(-10vw); }
                        10% { transform: translateY(2vh) translateX(10vw) scale(0.7); }
                        30% { transform: translateY(4vh) translateX(50vw) scale(0.8); }
                        50% { transform: translateY(0vh) translateX(90vw) scale(0.8); }
                        100% { transform: translateY(0vh) translateX(110vw) scale(0.8); }
                    }

                    @keyframes fade-in-out-poem {
                        0% { opacity: 0; transform: translateY(10px); } 15% { opacity: 1; transform: translateY(0); }
                        85% { opacity: 1; transform: translateY(0); }
                        100% { opacity: 0; transform: translateY(-10px); }
                    }
                `;

                this.injectionEngine.injectCss('the-world-loader-style', newLoaderCSS);
                const poems = [
                     { original: 'La noche está estrellada,<br>y tiritan, azules, los astros, a lo lejos.', translation: '夜在天空中布满星辰，<br>蓝色的星群，在远方颤抖。', author: '— 巴勃罗·聂鲁达' },
                     { original: 'The sky filled slowly with shades of violet and rose,<br>and the hills were purple.', translation: '天空缓缓充满了紫罗兰与玫瑰的色调，<br>远山呈现一片黛紫。', author: '— 弗吉尼亚·伍尔夫' },
                     { original: 'Higher still and higher<br>From the earth thou springest<br>Like a cloud of fire;', translation: '飞得更高，更高<br>你从地面一跃而起<br>像一团燃烧的火云', author: '— 雪莱' },
                     { original: 'La tarde que se inclina sobre el mundo<br>es de una luz que es casi una memoria;', translation: '这黄昏斜倚向世界<br>它的光几乎就是一种记忆；', author: '— 豪尔赫·路易斯·博尔赫斯' }
                ];

                const poetryHtml = poems.map((poem, i) => `
                    <div class="poem-wrapper" style="animation-delay: ${i * poetryFadeDuration}ms;">
                        <div class="poem-line poem-original">${poem.original}</div>
                        <div class="poem-line poem-translation">${poem.translation}</div>
                        <div class="poem-line poem-attribution">${poem.author}</div>
                    </div>
                `).join('');

                $overlay.html(`
                    <div class="tw-loader-bg-layer" id="loader-bg1"></div>
                    <div class="tw-loader-bg-layer" id="loader-bg2"></div>
                    <div id="loader-fx-bg"></div>
                    <div id="loader-fx-fg"></div>
                    <div class="tw-loader-poetry-container">${poetryHtml}</div>
                    <div class="tw-loader-brand-container">
                        <div class="tw-loader-title">The World</div>
                        <div class="tw-loader-subtitle">一扇望向故事深处的窗</div>
                    </div>
                    <div class="tw-loader-credits">
                        <span>by shiyue137</span>
                        <a href="https://github.com/shiyue1377" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i></a>
                    </div>
                    <button class="tw-loader-skip-btn">Skip</button>
                `);

                this.$('body').append($overlay);
                setTimeout(() => $overlay.css('opacity', 1), 50);

                $overlay.find('.tw-loader-skip-btn').on('click', () => this._cleanupAndResolve());

                this.animState = {
                    start: Date.now(),
                    duration: poemsDuration,
                    frameId: null,
                    bg1: $overlay.find('#loader-bg1')[0],
                    bg2: $overlay.find('#loader-bg2')[0],
                    activeLayer: 1,
                    poetryContainer: $overlay.find('.tw-loader-poetry-container')[0]
                };

                this.clouds = new Clouds3dFX({ $: this.$, config: this.config, logger: this.logger, state: this.state });
                this.clouds.activate(this._derivePeriodFromTime(0), '晴', {count:1.0}, this.$('#loader-fx-bg'), { transitionDuration: '3s' });

                const _createStars = () => {
                    const fxBg = this.$('#loader-fx-bg');
                    for (let i = 0; i < 150; i++) {
                        const size = 1 + Math.random() * 2;
                        const star = this.$('<div>').addClass('tw-loader-star').css({
                            width: `${size}px`, height: `${size}px`,
                            top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
                            opacity: 0.2 + Math.random() * 0.8,
                            'animation-delay': `${Math.random() * 4}s`
                        });
                        fxBg.append(star);
                    }
                };
                
                // _createBird function removed as per user request

                const _animateBg = () => {
                    if (!this.animState || !this.animState.frameId) return;
                    const elapsed = Date.now() - this.animState.start;
                    const progress = elapsed / this.animState.duration;
                    
                    if (progress >= 1) {
                        if (this.animState.frameId) cancelAnimationFrame(this.animState.frameId);
                        this.animState.frameId = null;
                        return;
                    }
                    
                    const simulatedTime = progress * 24;
                    const theme = this.timeGradient.getThemeForTime({ timeString: `${String(Math.floor(simulatedTime)).padStart(2, '0')}:${String(Math.floor((simulatedTime % 1) * 60)).padStart(2, '0')}` });
                    
                    this.animState.bg1.style.background = theme.background;
                    this.animState.bg1.style.opacity = 1;
                    this.animState.poetryContainer.className = `tw-loader-poetry-container ${theme.brightness === 'light' ? 'theme-light-text' : 'theme-dark-text'}`;
                    
                    if (this.clouds) {
                        const currentPeriod = this._derivePeriodFromTime(simulatedTime);
                        this.clouds.updateCloudColor(currentPeriod, '晴');
                    }

                    this.animState.frameId = requestAnimationFrame(_animateBg);
                };
                
                this.animState.frameId = requestAnimationFrame(_animateBg);
                _createStars();

                this._animationTimeouts.push(setTimeout(() => {
                    this.$('.tw-loader-star').css('opacity', '0');
                }, poetryFadeDuration));
                
                // Bird animation timeout removed
                
                this._animationTimeouts.push(setTimeout(() => {
                    this.$('.tw-loader-poetry-container').css('opacity', 0);
                }, poemsDuration));
                
                this._animationTimeouts.push(setTimeout(() => {
                    this.$('.tw-loader-brand-container').css('opacity', 1);
                }, poemsDuration + 500));

                this._animationTimeouts.push(setTimeout(() => this._cleanupAndResolve(), animationTotalDuration));

            }, 1000));
        });
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
}
