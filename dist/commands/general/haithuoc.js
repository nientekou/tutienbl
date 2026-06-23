"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const uiSystem_1 = require("../../utils/uiSystem");
const lamviec_1 = require("./lamviec");
class HaiThuocCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('haithuoc')
            .setDescription('Hái thuốc (Dược Sư) thu thập linh thảo (Tốn 10 Thể Lực)'));
    }
    async execute(client, interaction) {
        const result = (0, lamviec_1.performWork)(interaction.user.id, 'gathering');
        if (!result.success) {
            await interaction.editReply({ content: result.message });
            return;
        }
        const components = [];
        const encounter = result.encounter;
        if (encounter) {
            const row = new discord_js_1.ActionRowBuilder();
            encounter.choices.forEach((c, idx) => {
                row.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`encounter_${encounter.id}_${idx}_${interaction.user.id}`)
                    .setLabel(c.text.length > 80 ? c.text.substring(0, 77) + '...' : c.text)
                    .setStyle(discord_js_1.ButtonStyle.Primary));
            });
            components.push(row);
        }
        if (result.embed) {
            await interaction.editReply((0, uiSystem_1.toV2Payload)([result.embed], components));
        }
        else {
            await interaction.editReply({ content: result.message, components });
        }
    }
}
exports.default = HaiThuocCommand;
