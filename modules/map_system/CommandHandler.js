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

    _findNode(target) {
        if (this.mapDataManager.nodes.has(target)) {
            return this.mapDataManager.nodes.get(target);
        }
        for (const node of this.mapDataManager.nodes.values()) {
            if (node.name === target) {
                return node;
            }
        }
        return null;
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
                    const locationNode = this._findNode(value);
                    if (!locationNode) {
                        return `Error: Location "${value}" to set for player not found.`;
                    }
                    await this.locatorManager.updateLocator(locationNode.id);
                    return `Successfully updated player location to ${locationNode.name}.`;
                }

                const node = this._findNode(target);
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
            description: '向一个已知地点添加一个NPC。',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: '节点的ID或名称。' },
                    npc: { type: 'object', description: '要添加的NPC对象, 包含id和name。 e.g. {"id": "npc_hogger", "name": "霍格"}' },
                },
                required: ['target', 'npc'],
            },
            action: async (args) => {
                const { target, npc } = args;
                const node = this._findNode(target);
                if (!node) return `Error: Node "${target}" not found.`;
                if (!npc || !npc.id || !npc.name) return 'Error: Invalid NPC object provided.';
                
                await this.mapDataManager.addNpcToLocation(node.id, npc);
                return `Successfully added ${npc.name} to ${node.name}.`;
            },
        };
        this.tools.set('AddNPC', tool);
        this.context.registerFunctionTool(tool);
    }

    _registerRemoveNpc() {
        const tool = {
            name: 'Map.RemoveNPC',
            description: '从一个已知地点移除一个NPC。',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: '节点的ID或名称。' },
                    npcId: { type: 'string', description: '要移除的NPC的ID。' },
                },
                required: ['target', 'npcId'],
            },
            action: async (args) => {
                const { target, npcId } = args;
                const node = this._findNode(target);
                if (!node) return `Error: Node "${target}" not found.`;
                
                await this.mapDataManager.removeNpcFromLocation(node.id, npcId);
                return `Successfully removed NPC ${npcId} from ${node.name}.`;
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