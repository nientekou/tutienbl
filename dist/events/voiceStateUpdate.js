"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Event_1 = require("../structures/Event");
const VoiceRecoveryService_1 = require("../services/VoiceRecoveryService");
class VoiceStateUpdateEvent extends Event_1.Event {
    constructor() {
        super('voiceStateUpdate');
    }
    async execute(client, oldState, newState) {
        const targetGuildId = VoiceRecoveryService_1.VOICE_RECOVERY_CONFIG.TARGET_GUILD_ID;
        const userId = newState.id || oldState.id;
        // JOIN: oldState.channel === null, newState.channel !== null
        if (!oldState.channelId && newState.channelId && newState.guild.id === targetGuildId) {
            await VoiceRecoveryService_1.voiceRecoveryService.onVoiceJoin(client, userId, newState.guild.id, newState.channelId);
        }
        // LEAVE: oldState.channel !== null, newState.channel === null
        else if (oldState.channelId && !newState.channelId && oldState.guild.id === targetGuildId) {
            await VoiceRecoveryService_1.voiceRecoveryService.onVoiceLeave(client, userId);
        }
        // MOVE: channelId changed
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            if (oldState.guild.id === targetGuildId && newState.guild.id !== targetGuildId) {
                await VoiceRecoveryService_1.voiceRecoveryService.onVoiceLeave(client, userId);
            }
            else if (oldState.guild.id !== targetGuildId && newState.guild.id === targetGuildId) {
                await VoiceRecoveryService_1.voiceRecoveryService.onVoiceJoin(client, userId, newState.guild.id, newState.channelId);
            }
        }
    }
}
exports.default = VoiceStateUpdateEvent;
