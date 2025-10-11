
/**
 * The World - API Macro Manager
 * @description Registers all {{tw_...}} macros for developers.
 */
import { HOLIDAY_DATA } from '../utils/holidays.js';

export class MacroManager {
    constructor({ helper, state, mapSystem, logger, weatherForecaster }) {
        this.helper = helper;
        this.state = state;
        this.mapSystem = mapSystem;
        this.logger = logger;
        this.weatherForecaster = weatherForecaster;
    }

    registerAll() {
        this.logger.log('[MacroManager] Registering all "The World" macros...');
        this.register_tw_state();
        this.register_tw_player_location();
        this.register_tw_node_prop();
        this.register_tw_list_children();
        this.register_tw_list_npcs();
        this.register_tw_node_exists();
        this.register_tw_weekday();
        this.register_tw_holiday();
        this.register_tw_list_all_locations();
        this.register_tw_weather_forecast();
        this.logger.success('[MacroManager] All macros registered.');
    }

    /**
     * Finds a map node by its ID or name.
     * @param {string} idOrName The ID or name of the node.
     * @returns {MapNodeWithId|null} The found node or null.
     */
    _findNode(idOrName) {
        if (!idOrName) return null;
        if (this.mapSystem.mapDataManager.nodes.has(idOrName)) {
            return this.mapSystem.mapDataManager.nodes.get(idOrName);
        }
        for (const node of this.mapSystem.mapDataManager.nodes.values()) {
            if (node.name === idOrName) {
                return node;
            }
        }
        return null;
    }

    /**
     * Gets the current player location node from the state.
     * @returns {MapNodeWithId|null} The player's current location node or null.
     */
    _getPlayerLocationNode() {
        const playerNodeId = this.state.currentPlayerLocationId;
        if (!playerNodeId) return null;
        return this.mapSystem.mapDataManager.nodes.get(playerNodeId);
    }
    
    /**
     * Registers `{{tw_state::key}}`
     */
    register_tw_state() {
        const regex = /{{tw_state::(.*?_?.*?)}}/g;
        this.helper.registerMacroLike(regex, (context, substring, key) => {
            if (this.state.latestWorldStateData && this.state.latestWorldStateData[key]) {
                return String(this.state.latestWorldStateData[key]);
            }
            return '';
        });
    }

    /**
     * Registers `{{tw_player_location::property}}`
     */
    register_tw_player_location() {
        const regex = /{{tw_player_location::(id|name|type|description|status)}}/g;
        this.helper.registerMacroLike(regex, (context, substring, property) => {
            const node = this._getPlayerLocationNode();
            if (node && node.hasOwnProperty(property)) {
                return String(node[property] || '');
            }
            return '';
        });
    }
    
    /**
     * Registers `{{tw_node_prop::id_or_name::property}}`
     */
    register_tw_node_prop() {
        const regex = /{{tw_node_prop::(.*?)::(id|name|type|description|status|illustration|parentId|coords)}}/g;
        this.helper.registerMacroLike(regex, (context, substring, idOrName, property) => {
            const node = this._findNode(idOrName);
            if (node && node.hasOwnProperty(property)) {
                return String(node[property] || '');
            }
            return '';
        });
    }

    /**
     * Registers `{{tw_list_children::id_or_name}}`
     */
    register_tw_list_children() {
        const regex = /{{tw_list_children::(.*?_?.*?)}}/g;
        this.helper.registerMacroLike(regex, (context, substring, idOrName) => {
            const parentNode = this._findNode(idOrName);
            if (!parentNode) return '';
            
            const children = Array.from(this.mapSystem.mapDataManager.nodes.values())
                .filter(node => node.parentId === parentNode.id);
            
            return children.map(child => child.name).join(', ');
        });
    }

    /**
     * Registers `{{tw_list_npcs::id_or_name}}`
     */
    register_tw_list_npcs() {
        const regex = /{{tw_list_npcs::(.*?_?.*?)}}/g;
        this.helper.registerMacroLike(regex, (context, substring, idOrName) => {
            const node = this._findNode(idOrName);
            if (node && Array.isArray(node.npcs) && node.npcs.length > 0) {
                return node.npcs.map(npc => npc.name).join(', ');
            }
            return '';
        });
    }

    /**
     * Registers `{{tw_node_exists::id_or_name}}`
     */
    register_tw_node_exists() {
        const regex = /{{tw_node_exists::(.*?_?.*?)}}/g;
        this.helper.registerMacroLike(regex, (context, substring, idOrName) => {
            const node = this._findNode(idOrName);
            return node ? 'true' : 'false';
        });
    }

    /**
     * Registers `{{tw_weekday}}`
     */
    register_tw_weekday() {
        const regex = /{{tw_weekday}}/g;
        this.helper.registerMacroLike(regex, () => {
            const timeString = this.state.latestWorldStateData?.['时间'];
            if (!timeString) return '';

            const match = timeString.match(/(\d{4})[年-]?.*?(\d{1,2})[月-]?(\d{1,2})[日-]?/);
            if (match) {
                const [, year, month, day] = match;
                try {
                    const date = new Date(year, month - 1, day);
                    return `星期${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`;
                } catch (e) {
                    return '';
                }
            }
            return '';
        });
    }

    /**
     * Registers `{{tw_holiday}}`
     */
    register_tw_holiday() {
        const regex = /{{tw_holiday}}/g;
        this.helper.registerMacroLike(regex, () => {
            const timeString = this.state.latestWorldStateData?.['时间'];
            if (!timeString) return '';

            const match = timeString.match(/(\d{4})[年-]?.*?(\d{1,2})[月-]?(\d{1,2})[日-]?/);
            if (match) {
                const [, year, month, day] = match;
                const key = `${parseInt(month, 10)}-${parseInt(day, 10)}`;
                if (HOLIDAY_DATA[key]) {
                    return HOLIDAY_DATA[key].name;
                }
            }
            return '';
        });
    }
    
    /**
     * Registers `{{tw_list_all_locations}}`
     */
    register_tw_list_all_locations() {
        const regex = /{{tw_list_all_locations}}/g;
        this.helper.registerMacroLike(regex, () => {
            const nodes = Array.from(this.mapSystem.mapDataManager.nodes.values());
            if (!nodes || nodes.length === 0) {
                return '[No locations defined]';
            }
            return nodes.map(node => `${node.name} (${node.id})`).join(', ');
        });
    }

    /**
     * Registers `{{tw_weather_forecast}}`
     */
    register_tw_weather_forecast() {
        const regex = /{{tw_weather_forecast}}/g;
        this.helper.registerMacroLike(regex, () => {
            if (this.weatherForecaster) {
                return this.weatherForecaster.generateForecast();
            }
            return '[Weather system not initialized]';
        });
    }
}
