"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const FeastService_1 = require("../../services/FeastService");
class YenTiecCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('yentiec')
            .setDescription('Tham gia Tông Môn Yến Tiệc hằng ngày để hồi phục +100 Thể Lực'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const result = FeastService_1.feastService.joinFeast(userId);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🍲 TÔNG MÔN YẾN TIỆC')
            .setColor(result.success ? '#2ecc71' : '#e74c3c')
            .setDescription(result.message)
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    }
}
exports.default = YenTiecCommand;
