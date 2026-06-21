import { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { alchemyService } from '../../services/AlchemyService';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { userRepository } from '../../database/repositories/UserRepository';
import LuyenDanCommand from '../../commands/general/luyendan';
import { dailyQuestService } from '../../services/DailyQuestService';

export class LifeInteractionHandler {
  public static async handle(
    interaction: ButtonInteraction | StringSelectMenuInteraction,
    action: string,
    parts: string[],
    targetUserId: string
  ) {
    if (action === 'alch') {
      const subAction = parts[1];

      if (subAction === 'toggleqty') {
        const user = userRepository.get(targetUserId);
        if (!user) return;
        let yCanh: any = {};
        try {
          yCanh = JSON.parse(user.y_canh || '{}');
        } catch (e) {
          yCanh = {};
        }
        const currentQty = yCanh.active_craft_quantity || 1;
        const newQty = currentQty === 1 ? 2 : 1;
        yCanh.active_craft_quantity = newQty;
        
        userRepository.update(targetUserId, { y_canh: JSON.stringify(yCanh) });
        
        const luyenDanCmd = new LuyenDanCommand();
        const updatedEmbed = luyenDanCmd.getAlchemyEmbed(targetUserId);
        const updatedComponents = luyenDanCmd.getAlchemyComponents(targetUserId);
        
        await interaction.update({ embeds: [updatedEmbed], components: updatedComponents });
        return;
      }

      if (subAction === 'craft') {
        const user = userRepository.get(targetUserId);
        if (!user) return;
        let yCanh: any = {};
        try {
          yCanh = JSON.parse(user.y_canh || '{}');
        } catch (e) {
          yCanh = {};
        }
        const activeQty = yCanh.active_craft_quantity || 1;

        const inv = inventoryRepository.getUserInventory(targetUserId);
        const cauldrons = inv.filter(i => i.type === 'cauldron');
        let bestCauldron: any = null;
        if (cauldrons.length > 0) {
          const order = ['cauldron_high', 'cauldron_mid', 'cauldron_low'];
          for (const cid of order) {
            bestCauldron = cauldrons.find(i => i.item_id === cid);
            if (bestCauldron) break;
          }
        }

        const recipeId = parts.slice(2, -1).join('_');
        const res = alchemyService.craftPill(targetUserId, recipeId, bestCauldron?.id, activeQty);

        if (res.success) {
          dailyQuestService.updateProgress(targetUserId, 'daily_luyendan', activeQty);
        }

        const luyenDanCmd = new LuyenDanCommand();
        const updatedEmbed = luyenDanCmd.getAlchemyEmbed(targetUserId);
        const currentDesc = updatedEmbed.data.description || '';
        
        let resultIcon = res.success ? '✅' : '💥';
        updatedEmbed.setDescription(`🔔 **Kết quả luyện chế:** ${resultIcon} ${res.message}\n\n${currentDesc}`);
        
        const updatedComponents = luyenDanCmd.getAlchemyComponents(targetUserId);
        
        await interaction.update({ embeds: [updatedEmbed], components: updatedComponents });
      }
      return;
    }
  }
}
