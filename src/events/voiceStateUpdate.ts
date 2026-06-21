import { Event } from '../structures/Event';
import { TuTienClient } from '../client/TuTienClient';
import { voiceRecoveryService, VOICE_RECOVERY_CONFIG } from '../services/VoiceRecoveryService';

export default class VoiceStateUpdateEvent extends Event<'voiceStateUpdate'> {
  constructor() {
    super('voiceStateUpdate');
  }

  public async execute(client: TuTienClient, oldState: any, newState: any): Promise<void> {
    const targetGuildId = VOICE_RECOVERY_CONFIG.TARGET_GUILD_ID;
    const userId = newState.id || oldState.id;

    // JOIN: oldState.channel === null, newState.channel !== null
    if (!oldState.channelId && newState.channelId && newState.guild.id === targetGuildId) {
      await voiceRecoveryService.onVoiceJoin(client, userId, newState.guild.id, newState.channelId);
    }
    
    // LEAVE: oldState.channel !== null, newState.channel === null
    else if (oldState.channelId && !newState.channelId && oldState.guild.id === targetGuildId) {
      await voiceRecoveryService.onVoiceLeave(client, userId);
    }
    
    // MOVE: channelId changed
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      if (oldState.guild.id === targetGuildId && newState.guild.id !== targetGuildId) {
        await voiceRecoveryService.onVoiceLeave(client, userId);
      } else if (oldState.guild.id !== targetGuildId && newState.guild.id === targetGuildId) {
        await voiceRecoveryService.onVoiceJoin(client, userId, newState.guild.id, newState.channelId);
      }
    }
  }
}
