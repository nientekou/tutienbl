"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHuongDanAction = handleHuongDanAction;
const huongdan_1 = require("../../commands/general/huongdan");
const uiSystem_1 = require("../../utils/uiSystem");
async function handleHuongDanAction(interaction, action, parts, userId) {
    if (!interaction.isStringSelectMenu())
        return;
    const topic = interaction.values[0];
    const embed = (0, huongdan_1.getHuongDanEmbed)(topic);
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply((0, uiSystem_1.toV2Payload)([embed]));
    }
    else {
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
}
