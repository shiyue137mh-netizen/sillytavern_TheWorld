/**
 * The World - UI Dialogs
 * @description Manages all popup dialogs.
 */
export class UIDialogs {
    constructor({ $, triggerSlash, state }) {
        this.$ = $;
        this.triggerSlash = triggerSlash;
        this.state = state;
    }

    showKeywordInteractDialog(keyword) {
        this.removeDialog();
        const content = this.$(`<div><textarea placeholder="对 '${keyword}' 做什么?(例如：检查、拿起...)"></textarea></div>`);
        const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">取消</button><button class="dialog_confirm has-ripple">确认</button></div>');
        const dialog = this.createDialog(`与 '${keyword}' 互动`, content, buttons);
        dialog.find('.dialog_cancel').on('click', () => this.removeDialog());
        dialog.find('.dialog_confirm').on('click', () => {
            const userInput = dialog.find("textarea").val() || `观察 ${keyword}`;
            this.triggerSlash(`/send {{user}} ${userInput} ${keyword}`);
            this.removeDialog();
        });
    }

    showWeatherInteractDialog() {
        this.removeDialog();
        const weatherOptions = [
            { name: '晴天', icon: '☀️', text: '天空放晴，乌云散去，阳光洒了下来。' },
            { name: '多云', icon: '☁️', text: '天空中的云层变多了。' },
            { name: '刮风', icon: '🌬️', text: '风声从耳边传来，吹动了你的发梢。' },
            { name: '小雨', icon: '🌧️', text: '突然一些雨点落了下来。' },
            { name: '大雪', icon: '❄️', text: '天空飘下了雪花，越下越大。' },
            { name: '打雷', icon: '⚡️', text: '天边传来一阵闷雷。' },
            { name: '樱花', icon: '🌸', text: '风中带来了樱花瓣，开始了一场樱花雨。' },
            { name: '流星', icon: '🌠', text: '夜空中划过数道流星。' },
            { name: '萤火虫', icon: '✨', text: '几只萤火虫在黑暗中飞舞。' }
        ];
        const content = this.$(`<div class="ws-dialog-section"><h4>选择天气</h4><div class="ws-dialog-actions weather-actions"></div></div>`);
        const actionsContainer = content.find('.weather-actions');
        weatherOptions.forEach(opt => {
            actionsContainer.append(this.$(`<button class="has-ripple" data-text="${opt.text}">${opt.icon} ${opt.name}</button>`));
        });
        const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">关闭</button></div>');
        const dialog = this.createDialog('改变天气', content, buttons);
        dialog.find('.weather-actions button').on('click', (e) => {
            const text = this.$(e.currentTarget).data('text');
            this.triggerSlash(`/send <${text}>`);
            this.removeDialog();
        });
        dialog.find('.dialog_cancel').on('click', () => this.removeDialog());
    }

    showTimeInteractDialog() {
        this.removeDialog();
        let y = '', m = '', d = '', h = '', min = '';
        const now = new Date();
        if (this.state.latestWorldStateData && this.state.latestWorldStateData['时间']) {
            const match = this.state.latestWorldStateData['时间'].match(/(\d{4})[年-]?.*?(\d{1,2})[月-]?(\d{1,2})[日-]?.*?(\d{1,2}):(\d{1,2})/);
            if (match) [, y, m, d, h, min] = match;
        }
        if (!y) y = now.getFullYear();
        if (!m) m = now.getMonth() + 1;
        if (!d) d = now.getDate();
        if (!h) h = String(now.getHours()).padStart(2, '0');
        if (!min) min = String(now.getMinutes()).padStart(2, '0');

        const content = this.$(`
            <h4>快捷操作</h4>
            <div class="ws-dialog-actions">
                <button class="has-ripple" data-action="来到一小时后">[ 来到一小时后 ]</button>
                <button class="has-ripple" data-action="来到天亮">[ 来到天亮 ]</button>
                <button class="has-ripple" data-action="来到日出">[ 来到日出 ]</button>
                <button class="has-ripple" data-action="来到日落">[ 来到日落 ]</button>
                <button class="has-ripple" data-action="来到黄昏">[ 来到黄昏 ]</button>
                <button class="has-ripple" data-action="来到午夜">[ 来到午夜 ]</button>
            </div>
            <hr class="ws-dialog-separator">
            <h4>设定日期与时间</h4>
            <div class="ws-time-inputs">
                <input type="text" id="ws-year" value="${y}"><span>年</span>
                <input type="text" id="ws-month" value="${m}"><span>月</span>
                <input type="text" id="ws-day" value="${d}"><span>日</span>
                <input type="text" id="ws-hour" value="${h}"><span>:</span>
                <input type="text" id="ws-minute" value="${min}">
            </div>
            <hr class="ws-dialog-separator">
            <div class="ws-dialog-section">
                <h4>星期跳转</h4>
                <div class="ws-weekday-buttons">
                    <button class="has-ripple" data-weekday="一">一</button><button class="has-ripple" data-weekday="二">二</button>
                    <button class="has-ripple" data-weekday="三">三</button><button class="has-ripple" data-weekday="四">四</button>
                    <button class="has-ripple" data-weekday="五">五</button><button class="has-ripple" data-weekday="六">六</button>
                    <button class="has-ripple" data-weekday="日">日</button>
                </div>
            </div>`);
        const buttons = this.$('<div class="ws-dialog-buttons"><button class="dialog_cancel has-ripple">关闭</button></div>');
        const dialog = this.createDialog('时间流动', content, buttons);

        dialog.find('.ws-dialog-actions button').on('click', (e) => {
            const action = this.$(e.currentTarget).data('action');
            this.triggerSlash(`/send 时间${action}`);
            this.removeDialog();
        });

        dialog.find('.ws-weekday-buttons button').on('click', (e) => {
            const weekday = this.$(e.currentTarget).data('weekday');
            this.triggerSlash(`/send <时间往前推进，来到星期${weekday}>`);
            this.removeDialog();
        });

        dialog.find('.dialog_cancel').on('click', () => this.removeDialog());

        dialog.find('.ws-dialog-buttons').prepend(this.$('<button class="dialog_confirm has-ripple">确认</button>').on('click', () => {
            const yearVal = this.$('#ws-year').val(), monthVal = this.$('#ws-month').val(), dayVal = this.$('#ws-day').val(), hourVal = this.$('#ws-hour').val(), minuteVal = this.$('#ws-minute').val();
            const fullTimeString = `${yearVal}年${monthVal}月${dayVal}日 ${hourVal}:${minuteVal}`;
            this.triggerSlash(`/send <时间往前推进，来到“${fullTimeString}”>`);
            this.removeDialog();
        }));
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
            this.triggerSlash(`/setinput ${command}`);
            this.removeDialog();
        });
    }

    createDialog(title, content, buttons) {
        const dialog = this.$(`<div class="ws-dialog-overlay"><div class="ws-dialog"><h3>${title}</h3><div class="dialog-content"></div><div class="dialog-buttons-wrapper"></div></div></div>`);
        dialog.find(".dialog-content").append(content);
        dialog.find(".dialog-buttons-wrapper").append(buttons);
        this.$("body").append(dialog);
        dialog.on("click", (event) => {
            if (this.$(event.target).hasClass("ws-dialog-overlay")) {
                this.removeDialog();
            }
        });
        return dialog;
    }

    removeDialog() {
        const overlay = this.$(".ws-dialog-overlay");
        if (overlay.length > 0) {
            overlay.addClass("closing");
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    }
}
