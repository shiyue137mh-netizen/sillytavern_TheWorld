/**
 * The World - Command Parser (Functional Syntax Version)
 * @description Parses text for standardized game commands from the AI.
 */
import { Logger } from '../logger.js';

export class CommandParser {
    constructor({ logger }) {
        this.logger = logger || Logger;
    }

    /**
     * Extracts all valid functional commands from a block of text.
     * @param {string} text The text content from the AI's message.
     * @returns {Array<object>} An array of parsed command objects.
     */
    parse(text) {
        if (!text || typeof text !== 'string') return [];
        
        const commandBlockRegex = /<command>([\s\S]*?)<\/command>/g;
        let commandContent = '';
        let match;

        while ((match = commandBlockRegex.exec(text)) !== null) {
            commandContent += match[1].trim();
        }

        if (!commandContent) {
            return [];
        }

        const commands = [];
        let openBrackets = 0;
        let commandStart = -1;

        for (let i = 0; i < commandContent.length; i++) {
            if (commandContent[i] === '[') {
                if (openBrackets === 0) {
                    commandStart = i;
                }
                openBrackets++;
            } else if (commandContent[i] === ']') {
                openBrackets--;
                if (openBrackets === 0 && commandStart !== -1) {
                    const commandString = commandContent.substring(commandStart + 1, i);
                    const parsed = this._parseFunctionCall(commandString);
                    if (parsed) {
                        commands.push(parsed);
                    }
                    commandStart = -1;
                }
            }
        }
        
        return commands;
    }
    
    /**
     * Parses a single function call string.
     * @param {string} callString The content inside the brackets `[]`.
     * @returns {object|null} A parsed command object or null if parsing fails.
     */
    _parseFunctionCall(callString) {
        if (!callString) return null;

        const match = callString.trim().match(/^(\w+)\.(\w+)\(([\s\S]*)\)$/);

        if (!match) {
            this.logger.warn(`Invalid function call format: "${callString}"`);
            return null;
        }

        const [, module, func, argsString] = match;
        let args = [];

        if (argsString.trim()) {
            try {
                // Wrap in array brackets to parse as a list of arguments
                args = JSON.parse(`[${argsString}]`);
            } catch (e) {
                this.logger.error('Failed to parse command arguments:', e, { args: `[${argsString}]` });
                return null;
            }
        }
        
        const command = { module, function: func, args };
        this.logger.log(`Successfully parsed command: ${command.module}.${command.function}`);
        return command;
    }
}