"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const FeastService_1 = require("../../services/FeastService");
const uiSystem_1 = require("../../utils/uiSystem");
const v2Components_1 = require("../../utils/v2Components");
class YenTiecCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('yentiec')
            .setDescription('Tham gia Tông Môn Yến Tiệc hằng ngày để hồi phục +100 Thể Lực'));
    }
    async execute(client, interaction) {
        const userId = interaction.user.id;
        const result = FeastService_1.feastService.joinFeast(userId);
        const embed = (0, v2Components_1.container)(result.success ? v2Components_1.V2_COLORS.success : v2Components_1.V2_COLORS.danger, [
            (0, v2Components_1.header)('🍲 TÔNG MÔN YẾN TIỆC'),
            (0, v2Components_1.separator)(),
            (0, v2Components_1.body)(result.message)
        ]);
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
}
exports.default = YenTiecCommand;
