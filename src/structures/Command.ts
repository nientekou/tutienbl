import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { TuTienClient } from '../client/TuTienClient';

export abstract class Command {
  constructor(
    public readonly data:
      | SlashCommandBuilder
      | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
      | SlashCommandSubcommandsOnlyBuilder
      | SlashCommandOptionsOnlyBuilder
  ) {}


  /**
   * Phương thức thực thi logic của command
   * @param client Client bot Tu Tiên
   * @param interaction Interaction của lệnh slash command
   */
  public abstract execute(client: TuTienClient, interaction: ChatInputCommandInteraction): Promise<unknown> | unknown;
}
