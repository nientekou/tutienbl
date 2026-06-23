"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const uiSystem_1 = require("../../utils/uiSystem");
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
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
}
exports.default = YenTiecCommand;
