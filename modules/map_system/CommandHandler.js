/**
 * The World - Map Command Handler
 * @description Registers and processes all <command> instructions related to the map system.
 */

export class CommandHandler {
    constructor({ logger, context, mapDataManager, locatorManager }) {
        this.logger = logger;
        this.context = context;
        this.mapDataManager = mapDataManager;
        this.locatorManager = locatorManager;
        this.tools = new Map();
    }

    registerCommands() {
        this.logger.log('[CommandHandler] Registering map commands...');
        
        this._registerSetProperty();
        this._registerAddNpc();
        this._registerRemoveNpc();
        this._registerAddPoi();
    }

    async executeCommand(command) {
        const { function: func, args: argArray } = command;
        const tool = this.tools.get(func);

        if (!tool) {
            this.logger.warn(`[CommandHandler] Attempted to execute unknown command: Map.${func}`);
            return;
        }

        const argObject = {};
        if (tool.parameters && tool.parameters.required) {
            tool.parameters.required.forEach((paramName, index) => {
                if (index < argArray.length) {
                    argObject[paramName] = argArray[index];
                }
            });
        }

        this.logger.log(`[CommandHandler] Executing Map.${func} with args:`, argObject);
        try {
            const result = await tool.action(argObject);
            this.logger.log(`[CommandHandler] Map.${func} executed with result:`, result);
        } catch (error) {
            this.logger.error(`[CommandHandler] Error executing Map.${func}:`, error);
        }
    }

    _registerSetProperty() {
        const tool = {
            name: 'Map.SetProperty',
            displayName: '地图属性设置',
            description: '修改一个地图上已知节点的单个属性，例如状态或描述。也可用于设置玩家当前位置。',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: '要修改的节点的ID或中文名称，或特殊目标 "player_location"。' },
                    property: { type: 'string', description: '要修改的属性名称 (例如: "status", "description", 或 "current_location_id")。' },
                    value: { type: 'string', description: '要设置的新值。' },
                },
                required: ['target', 'property', 'value'],
            },
            action: async (args) => {
                const { target, property, value } = args;

                // Special case for setting player location, triggers locator update
                if (target === 'player_location' && property === 'current_location_id') {
                    const locationNode = this.mapDataManager.findNodeByIdOrName(value);
                    if (!locationNode) {
                        return `Error: Location "${value}" to set for player not found.`;
                    }
                    await this.locatorManager.updateLocator(locationNode.id);
                    return `Successfully updated player location to ${locationNode.name}.`;
                }

                const node = this.mapDataManager.findNodeByIdOrName(target);
                if (!node) {
                    return `Error: Node "${target}" not found.`;
                }
                
                await this.mapDataManager.updateNodeDetail(node.id, { [property]: value });
                
                return `Successfully set ${property} of ${node.name} to ${value}.`;
            },
        };
        this.tools.set('SetProperty', tool);
        this.context.registerFunctionTool(tool);
    }

    _registerAddNpc() {
        const tool = {
            name: 'Map.AddNPC',
            displayName: '添加NPC到地点',
            description: '向一个已知地点添加一个NPC。只需提供NPC的名称，系统会自动为其生成一个唯一的内部ID。',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: '目标地点的ID或名称。' },
                    npcName: { type: 'string', description: '要添加的NPC的名称。' },
                },
                required: ['target', 'npcName'],
            },
            action: async (args) => {
                const { target, npcName } = args;
                const node = this.mapDataManager.findNodeByIdOrName(target);
                if (!node) return `Error: Node "${target}" not found.`;
                if (!npcName || typeof npcName !== 'string' || npcName.trim() === '') {
                    return 'Error: Invalid NPC name provided.';
                }

                // Generate a unique, short, random ID that is unrelated to the name
                // to avoid confusing the AI.
                const npcId = Math.random().toString(36).substring(2, 8);
                const npcObject = { id: npcId, name: npcName.trim() };

                await this.mapDataManager.addNpcToLocation(node.id, npcObject);
                return `Successfully added NPC "${npcName}" to ${node.name}.`;
            },
        };
        this.tools.set('AddNPC', tool);
        this.context.registerFunctionTool(tool);
    }

    _registerRemoveNpc() {
        const tool = {
            name: 'Map.RemoveNPC',
            displayName: '从地点移除NPC',
            description: '根据NPC的名称从一个已知地点移除一个NPC。如果存在同名NPC，将移除第一个匹配项。',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: '目标地点的ID或名称。' },
                    npcName: { type: 'string', description: '要移除的NPC的名称。' },
                },
                required: ['target', 'npcName'],
            },
            action: async (args) => {
                const { target, npcName } = args;
                const node = this.mapDataManager.findNodeByIdOrName(target);
                if (!node) return `Error: Node "${target}" not found.`;
                if (!node.npcs || node.npcs.length === 0) {
                    return `Error: No NPCs found at "${node.name}".`;
                }

                const npcToRemove = node.npcs.find(n => n.name === npcName);
                if (!npcToRemove) {
                    return `Error: NPC with name "${npcName}" not found at "${node.name}".`;
                }

                await this.mapDataManager.removeNpcFromLocation(node.id, npcToRemove.id);
                return `Successfully removed NPC "${npcName}" from ${node.name}.`;
            },
        };
        this.tools.set('RemoveNPC', tool);
        this.context.registerFunctionTool(tool);
    }

    _registerAddPoi() {
        const tool = {
            name: 'Map.AddPOI',
            description: '在地图上添加一个临时的兴趣点（POI）。',
            parameters: {
                type: 'object',
                properties: {
                    mapId: { type: 'string', description: 'POI所在的地图ID。' },
                    poi: { type: 'object', description: '要添加的POI对象, 包含name, description, approx_coords等。' },
                },
                required: ['mapId', 'poi'],
            },
            action: async (args) => {
                this.logger.log('Executing Map.AddPOI (Not yet fully implemented):', args);
                return `POI "${args.poi.name}" added to map ${args.mapId}.`;
            },
        };
        this.tools.set('AddPOI', tool);
        this.context.registerFunctionTool(tool);
    }
}