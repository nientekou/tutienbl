"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Command_1 = require("../../structures/Command");
const lamviec_1 = require("./lamviec");
class DaoKhoangCommand extends Command_1.Command {
    constructor() {
        super(new discord_js_1.SlashCommandBuilder()
            .setName('daokhoang')
            .setDescription('Đào khoáng (Khoáng Sư) thu thập quặng kim loại (Tốn 10 Thể Lực)'));
    }
    async execute(client, interaction) {
        await interaction.deferReply();
        const result = (0, lamviec_1.performWork)(interaction.user.id, 'mining');
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
            await interaction.editReply({ embeds: [result.embed], components });
        }
        else {
            await interaction.editReply({ content: result.message, components });
        }
    }
}
exports.default = DaoKhoangCommand;
