/**
 * The World - State Parser
 * @description Parses WorldState and Map tags from AI messages.
 */
export class StateParser {
    constructor({ config, logger }) {
        this.config = config;
        this.logger = logger;
    }

    parseAttributes(text) {
        const attributes = {};
        const match = text.match(/\((.*)\)/);
        if (match) {
            const attributesStr = match[1];
            const name = text.substring(0, match.index).trim();
            attributesStr.split(",").forEach(part => {
                const [key, value] = part.split(":").map(t => t.trim());
                if (key && value) {
                    attributes[key] = value;
                }
            });
            return { name, attributes };
        }
        return { name: text, attributes: {} };
    }

    parseLocationItem(itemText) {
        let text = itemText.trim();
        if (!text) return null;
        let travelTime = null;
        const timeMatch = text.match(/^\((\d+[mhd])\)\s*/);
        if (timeMatch) {
            travelTime = timeMatch[1];
            text = text.substring(timeMatch[0].length);
        }
        let locationPart = text;
        let characterPart = '';
        const atIndex = text.indexOf('@');
        if (atIndex !== -1) {
            locationPart = text.substring(0, atIndex).trim();
            characterPart = text.substring(atIndex + 1).trim();
        }
        let name = locationPart;
        let description = null;
        const descMatch = name.match(/~\"(.*?)\"$/);
        if (descMatch) {
            description = descMatch[1];
            name = name.substring(0, name.length - descMatch[0].length).trim();
        }
        const { name: finalName, attributes } = this.parseAttributes(name);
        let characters = [];
        if (characterPart) {
            characters = characterPart.split(',').map(c => {
                const charTrimmed = c.trim();
                const actionMatch = charTrimmed.match(/(.*)\((.*)\)/);
                const charName = actionMatch ? actionMatch[1].trim() : charTrimmed;
                const charAction = actionMatch ? actionMatch[2].trim() : null;
                return { name: charName, action: charAction, icon: null };
            });
        }
        return { name: finalName, characters, travelTime, description, bg: attributes['插图'] || null };
    }

    parseMapData(text) {
        this.logger.log('正在解析 <Map> 标签...');
        const result = { moveBlock: false, locations: [] };
        let content = text.trim();
        const moveBlockMatch = content.match(/^\[MOVEBLOCK:(YES|NO)\]\s*/);
        if (moveBlockMatch) {
            result.moveBlock = moveBlockMatch[1] === 'YES';
            content = content.substring(moveBlockMatch[0].length);
        }
        const mainLocationRegex = /\[(.*?)\]([^[]*)/g;
        let match;
        while ((match = mainLocationRegex.exec(content)) !== null) {
            const mainLocationData = this.parseLocationItem(match[1]);
            if (!mainLocationData) continue;
            const subLocationsText = match[2].trim();
            const subLocations = subLocationsText ? subLocationsText.split('|').map(item => this.parseLocationItem(item)).filter(Boolean) : [];
            result.locations.push({ ...mainLocationData, subLocations: subLocations });
        }
        this.logger.log('地图数据解析结果:', result);
        return result;
    }

    parseWorldState(text) {
        this.logger.log('正在解析 <WorldState> 标签...');
        const data = {};
        const keys = ['时间', '季节', '时段', '天气', '地点', '场景', '插图'];
        const regex = new RegExp(`(${keys.join('|')})[:：](.*?)(?=\\s*(?:${keys.join('|')})[:：]|$)`, 'gs');
        const matches = text.matchAll(regex);
        for (const match of matches) {
            data[match[1].trim()] = match[2].trim();
        }
        this.logger.log('世界状态解析结果:', data);
        return data;
    }
}