import { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, MessageFlags, Routes } from 'discord.js';
import { userRepository } from '../../database/repositories/UserRepository';
import { inventoryRepository } from '../../database/repositories/InventoryRepository';
import { inventoryService } from '../../services/InventoryService';
import { getShopEmbed, getShopComponents, SHOP_ITEMS, checkAndUpdateWeeklyLimit } from '../../commands/general/shop';
import { getShopKyNangEmbed, getShopKyNangComponents, SKILL_BOOKS } from '../../commands/general/shopkynang';
import { safeV2Update, safeV2TextUpdate, EMBED_COLORS, toV2Payload, textToV2 } from '../../utils/uiSystem';
import { ITEMS } from '../../config/itemConstants';
import db from '../../database/database';

type AnyInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

export async function handleMarketAction(
  interaction: AnyInteraction,
  action: string,
  parts: string[],
  userId: string
): Promise<void> {
  try {
    const targetUserId = userId;

    // --- CỬA HÀNG NAV ---
    if (action === 'shopnav') {
      const embed = getShopEmbed(targetUserId);
      const rows = getShopComponents(targetUserId);
      const rowsArr = Array.isArray(rows) ? rows : [rows];
      await safeV2Update(interaction, [embed], rowsArr);
      return;
    }

    // --- CỬA HÀNG PHÂN KHU ---
    if (action === 'shop') {
      let primaryId: string | undefined;
      let subId: string | undefined;
      let page = 1;

      if (parts.length >= 5) {
        primaryId = parts[1];
        subId = parts[2];
        page = parseInt(parts[3]) || 1;
      } else if (parts.length === 3) {
        primaryId = parts[1];
      }

      const embed = getShopEmbed(targetUserId, primaryId, subId, page);
      const rows = getShopComponents(targetUserId, primaryId, subId, page);
      const rowsArr = Array.isArray(rows) ? rows : [rows];
      await safeV2Update(interaction, [embed], rowsArr);
      return;
    }

    // --- TÌM KIẾM CỬA HÀNG ---
    if (action === 'shopsearch') {
      const modal = new ModalBuilder()
        .setCustomId(`shopsearchmodal_${targetUserId}`)
        .setTitle('🔍 Tìm Kiếm Vật Phẩm');
      const searchInput = new TextInputBuilder()
        .setCustomId('search_query')
        .setLabel('Nhập tên hoặc mã vật phẩm')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(100);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(searchInput));
      await (interaction as any).showModal(modal);
      return;
    }

    // --- TIỆM SÁCH KỸ NĂNG ---
    if (action === 'shopkynangnav') {
      const embed = getShopKyNangEmbed(targetUserId);
      const sknComps = getShopKyNangComponents(targetUserId);
      const rowsArr = Array.isArray(sknComps) ? sknComps : [sknComps];
      await safeV2Update(interaction, [embed], rowsArr);
      return;
    }

    // --- LỮ KHÁCH THẦN BÍ: MỞ MENU CHỌN ---
    if (action === 'traveler_buy') {
      const eventId = parseInt(parts[1], 10);
      const event = db.prepare('SELECT * FROM traveler_events WHERE id = ?').get(eventId) as any;
      if (!event || event.status !== 'active') {
        await interaction.reply({ content: '❌ Lữ Khách đã không còn ở đây nữa!', flags: MessageFlags.Ephemeral });
        return;
      }

      let inventory: Record<string, any> = {};
      try { inventory = JSON.parse(event.inventory || '{}'); } catch (e) {}

      const options = [];
      for (const [id, item] of Object.entries(inventory)) {
        if (item.quantity > 0) {
          options.push({
            label: `${item.name} (${item.price} LT)`,
            description: `Còn lại: ${item.quantity}`,
            value: item.id
          });
        }
      }

      if (options.length === 0) {
        await interaction.reply({ content: '❌ Lữ Khách đã hết sạch hàng!', flags: MessageFlags.Ephemeral });
        return;
      }

      const { StringSelectMenuBuilder: SB, ActionRowBuilder: AR } = require('discord.js');
      const selectMenu = new SB()
        .setCustomId(`traveler_buy_item_${eventId}`)
        .setPlaceholder('Chọn vật phẩm muốn mua')
        .addOptions(options);

      const row = new AR().addComponents(selectMenu);
      await interaction.reply({ components: [textToV2('Đạo hữu muốn mua gì?'), row], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // --- LỮ KHÁCH: MUA VẬT PHẨM ---
    else if (action === 'traveler_buy_item' && interaction.isStringSelectMenu()) {
      const eventId = parseInt(parts[1], 10);
      const itemId = interaction.values[0];
      const { travelerService } = require('../../services/TravelerService');

      try {
        const result = travelerService.buyItem(interaction.user.id, eventId, itemId, 1);
        if (result.success) {
          await safeV2TextUpdate(interaction, result.message);

          try {
            const event = db.prepare('SELECT * FROM traveler_events WHERE id = ?').get(eventId) as any;
            if (event && event.message_id && event.channel_id && /^\d{17,20}$/.test(event.channel_id)) {
              const channel = await interaction.client.channels.fetch(event.channel_id) as any;
              if (channel) {
                const msg = await channel.messages.fetch(event.message_id).catch(() => null);
                if (msg) {
                  let inv: Record<string, any> = {};
                  try { inv = JSON.parse(event.inventory || '{}'); } catch (e) {}

                  const { EmbedBuilder: EB } = require('discord.js');
                  const embed = EB.from(msg.embeds[0]);

                  if (event.status === 'sold_out') {
                    embed.setTitle('👺 Lữ Khách Thần Bí (Đã Rời Đi)');
                    embed.setDescription('Lữ Khách đã bán hết sạch hàng và rời đi.');
                    embed.setFields([]);
                    await interaction.client.rest.patch(Routes.channelMessage(event.channel_id, event.message_id), { body: { embeds: [embed.toJSON()], components: [] } });
                  } else {
                    const newFields = { name: '💰 Hàng Hoá', value: Object.values(inv).map((i: any) => `- **${i.name}** (Còn: ${i.quantity}) - Giá: ${i.price} LT`).join('\n') };
                    embed.setFields([newFields]);
                    const { ButtonBuilder: LBB, ButtonStyle: LS, ActionRowBuilder: LAR } = require('discord.js');
                    const buyBtn = new LBB()
                      .setCustomId(`traveler_buy_${eventId}`)
                      .setLabel('💰 Giao Dịch')
                      .setStyle(LS.Success);
                    const robBtn = new LBB()
                      .setCustomId(`traveler_rob_${eventId}`)
                      .setLabel('⚔️ Cướp Đoạt')
                      .setStyle(LS.Danger);
                    const row = new LAR().addComponents(buyBtn, robBtn);
                    await interaction.client.rest.patch(Routes.channelMessage(event.channel_id, event.message_id), { body: { embeds: [embed.toJSON()], components: [row.toJSON()] } });
                  }
                }
              }
            }
          } catch (e) {
            console.error('Update traveler message failed', e);
          }
        } else {
          await safeV2TextUpdate(interaction, `❌ ${result.message}`);
        }
      } catch (buyErr: any) {
        console.error('[TravelerBuy] Lỗi mua hàng:', buyErr);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ Có lỗi xảy ra khi mua hàng từ Lữ Khách!', flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: '❌ Có lỗi xảy ra khi mua hàng từ Lữ Khách!', flags: MessageFlags.Ephemeral });
          }
        } catch (_) {}
      }
    }

    // --- LỮ KHÁCH: CƯỚP ---
    else if (action === 'traveler_rob') {
      const eventId = parseInt(parts[1], 10);
      const { travelerService } = require('../../services/TravelerService');
      const result = travelerService.challengeTraveler(interaction.user.id, eventId);

      if (result.success) {
        await interaction.reply({ content: result.message });
        try {
          const event = db.prepare('SELECT * FROM traveler_events WHERE id = ?').get(eventId) as any;
          if (event && event.message_id && event.channel_id && /^\d{17,20}$/.test(event.channel_id)) {
            const channel = await interaction.client.channels.fetch(event.channel_id) as any;
            if (channel) {
              const msg = await channel.messages.fetch(event.message_id).catch(() => null);
              if (msg) {
                const { EmbedBuilder: EB } = require('discord.js');
                const embed = EB.from(msg.embeds[0]);
                embed.setTitle('👺 Lữ Khách Thần Bí (Đã Bỏ Chạy)');
                embed.setDescription(`Lữ Khách đã bị **${interaction.user.username}** đánh bại và cướp sạch hàng hoá!`);
                embed.setFields([]);
                await interaction.client.rest.patch(Routes.channelMessage(event.channel_id, event.message_id), { body: { embeds: [embed.toJSON()], components: [] } });
              }
            }
          }
        } catch (e) {}
      } else {
        await interaction.reply({ content: result.message });
      }
    }

    // --- ĐỔI TIỀN: SELECT MENU → HIỆN MODAL ---
    else if (action === 'doitienselect' && interaction.isStringSelectMenu()) {
      const selectedValue = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`doitienmodal_${targetUserId}_${selectedValue}`)
        .setTitle('Phường Thị Đổi Tiền');

      const qtyInput = new TextInputBuilder()
        .setCustomId('doitien_qty')
        .setLabel('Số lượng lần muốn đổi')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nhập số lượng lớn hơn 0 (ví dụ: 1)')
        .setValue('1')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(qtyInput)
      );

      await (interaction as any).showModal(modal);
    }

    // --- ĐỔI TIỀN: MODAL SUBMIT ---
    else if (action === 'doitienmodal') {
      const type = parts.slice(2).join('_');
      const qtyStr = (interaction as ModalSubmitInteraction).fields.getTextInputValue('doitien_qty');
      const qty = parseInt(qtyStr, 10);

      if (isNaN(qty) || qty <= 0) {
        await interaction.reply({ content: '❌ Số lượng lần đổi phải là số nguyên lớn hơn 0!', flags: MessageFlags.Ephemeral });
        return;
      }

      const DoiTienCommand = require('../../commands/general/doitien').default;
      const { getDoiTienEmbed, getDoiTienComponents } = require('../../commands/general/doitien');

      const res = DoiTienCommand.performConversion(targetUserId, type, qty);
      if (!res.success) {
        await interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
        return;
      }

      const embed = getDoiTienEmbed(targetUserId);
      const components = getDoiTienComponents(targetUserId);

      if ((interaction as any).update) {
        await safeV2Update(interaction, [embed], components);
        await interaction.followUp({ content: `✅ Quy đổi thành công! ${res.message}`, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: `✅ Quy đổi thành công! ${res.message}`, flags: MessageFlags.Ephemeral });
      }
    }

    // --- CỬA HÀNG: CHỌN MUA → HIỆN MODAL ---
    else if (action === 'shopbuy' && interaction.isStringSelectMenu()) {
      const itemId = interaction.values[0];
      const item = SHOP_ITEMS.find(i => i.id === itemId);
      const buyer = userRepository.get(targetUserId);

      if (!item || !buyer) {
        await interaction.reply({ content: '❌ Vật phẩm không hợp lệ!', flags: MessageFlags.Ephemeral });
        return;
      }

      const activeCategory = parts[1];
      const pageNum = parts[2];
      const cleanName = item.name.replace(/^[\s\p{Emoji}\p{Symbol}]+/gu, '').replace(/^[- :]+/g, '').trim().substring(0, 30);

      const modal = new ModalBuilder()
        .setCustomId(`shopbuymodal_${targetUserId}_${itemId}:${activeCategory}:${pageNum}`)
        .setTitle(`Mua ${cleanName}`);

      const qtyInput = new TextInputBuilder()
        .setCustomId('buy_qty')
        .setLabel('Số lượng muốn mua')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nhập số lượng lớn hơn 0 (ví dụ: 1)')
        .setValue('1')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(qtyInput)
      );

      await (interaction as any).showModal(modal);
    }

    // --- CỬA HÀNG MODAL: XÁC NHẬN MUA ---
    else if (action === 'shopbuymodal') {
      const rest = parts.slice(2).join('_');
      const subParts = rest.split(':');
      const itemId = subParts[0];
      const activeCategory = subParts[1];
      const pageNum = parseInt(subParts[2], 10) || 1;
      const qtyStr = (interaction as ModalSubmitInteraction).fields.getTextInputValue('buy_qty');
      const qty = parseInt(qtyStr, 10);

      if (isNaN(qty) || qty <= 0) {
        await interaction.reply({ content: '❌ Số lượng mua phải là số nguyên lớn hơn 0!', flags: MessageFlags.Ephemeral });
        return;
      }

      const item = SHOP_ITEMS.find(i => i.id === itemId);

      if (!item) {
        await interaction.reply({ content: '❌ Vật phẩm không hợp lệ!', flags: MessageFlags.Ephemeral });
        return;
      }

      const totalCost = item.price * qty;

      if (item.currency === 'knb') {
        let realItemId = item.id;
        if (item.id === ITEMS.ITEM_NHAN_DINH_HON_KNB) realItemId = ITEMS.ITEM_NHAN_DINH_HON;
        if (item.id === ITEMS.ITEM_BLOODLINE_PILL_KNB) realItemId = ITEMS.ITEM_BLOODLINE_PILL;

        const tx = db.transaction(() => {
          const buyerRow = userRepository.get(targetUserId);
          if (!buyerRow) throw new Error('Đạo hữu chưa khởi tạo nhân vật');
          if (buyerRow.knb < totalCost) throw new Error(`Không đủ KNB! (Cần: ${totalCost}, có: ${buyerRow.knb})`);
          checkAndUpdateWeeklyLimit(targetUserId, item.id, qty);
          userRepository.update(targetUserId, { knb: buyerRow.knb - totalCost });
          inventoryRepository.addItem(targetUserId, realItemId, qty);
        });

        try {
          tx();
        } catch (error: any) {
          await interaction.reply({ content: `❌ Mua nhanh thất bại: ${error.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getShopEmbed(targetUserId, activeCategory, undefined, pageNum);
        const shopComps = getShopComponents(targetUserId, activeCategory, undefined, pageNum);
        const rowsArr = Array.isArray(shopComps) ? shopComps : [shopComps];

        if ((interaction as any).update) {
          await safeV2Update(interaction, [embed], rowsArr);
          await interaction.followUp({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} KNB)!`, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} KNB)!`, flags: MessageFlags.Ephemeral });
        }
      } else {
        const tx = db.transaction(() => {
          const buyerRow = userRepository.get(targetUserId);
          if (!buyerRow) throw new Error('Đạo hữu chưa khởi tạo nhân vật');
          if (buyerRow.coin_ha_pham < totalCost) throw new Error(`Không đủ Linh Thạch! (Cần: ${totalCost}, có: ${buyerRow.coin_ha_pham})`);
          checkAndUpdateWeeklyLimit(targetUserId, item.id, qty);
          userRepository.update(targetUserId, { coin_ha_pham: buyerRow.coin_ha_pham - totalCost });
          inventoryRepository.addItem(targetUserId, item.id, qty);
        });

        try {
          tx();
        } catch (error: any) {
          await interaction.reply({ content: `❌ Mua nhanh thất bại: ${error.message}`, flags: MessageFlags.Ephemeral });
          return;
        }

        const embed = getShopEmbed(targetUserId, activeCategory, undefined, pageNum);
        const shopComps = getShopComponents(targetUserId, activeCategory, undefined, pageNum);
        const rowsArr = Array.isArray(shopComps) ? shopComps : [shopComps];

        if ((interaction as any).update) {
          await safeV2Update(interaction, [embed], rowsArr);
          await interaction.followUp({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} Linh Thạch)!`, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: `🛒 Mua thành công **${qty}x ${item.name}** (−${totalCost} Linh Thạch)!`, flags: MessageFlags.Ephemeral });
        }
      }
    }

    // --- THỈNH BÍ TỊCH KỸ NĂNG ---
    else if (action === 'sknbuy' && interaction.isStringSelectMenu()) {
      const bookId = interaction.values[0];
      const book = SKILL_BOOKS.find(b => b.id === bookId);
      const buyer = userRepository.get(targetUserId);

      if (!book || !buyer) {
        await interaction.reply({ content: '❌ Bí tịch không hợp lệ!', flags: MessageFlags.Ephemeral });
        return;
      }

      if (buyer.coin_ha_pham < book.price) {
        await interaction.reply({
          content: `❌ Đạo hữu không đủ Linh Thạch! (Giá: **${book.price}**, hiện có: **${buyer.coin_ha_pham}**).`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      userRepository.update(targetUserId, { coin_ha_pham: buyer.coin_ha_pham - book.price });
      inventoryRepository.addItem(targetUserId, book.id, 1);

      const primaryId = parts[1];
      const pageNum = parseInt(parts[2], 10) || 1;
      const embed = getShopEmbed(targetUserId, primaryId, undefined, pageNum);
      const sknComps = getShopComponents(targetUserId, primaryId, undefined, pageNum);
      const rowsArr = Array.isArray(sknComps) ? sknComps : [sknComps];
      await safeV2Update(interaction, [embed], rowsArr);
      await interaction.followUp({ content: `📚 Thỉnh thành công **1x ${book.name}** (−${book.price} Linh Thạch)! Dùng \`/dungkynang item_id: ${book.id}\` để lĩnh ngộ.`, flags: MessageFlags.Ephemeral });
    }

    // --- TÌM KIẾM CỬA HÀNG ---
    else if (action === 'shopsearchmodal') {
      const searchQuery = (interaction as ModalSubmitInteraction).fields.getTextInputValue('search_query');
      const embed = getShopEmbed(targetUserId, undefined, undefined, 1, searchQuery);
      const rows = getShopComponents(targetUserId, undefined, undefined, 1, searchQuery);
      if ((interaction as any).update) {
        await safeV2Update(interaction, [embed], rows);
      } else {
        await interaction.reply(toV2Payload([embed], rows));
      }
    }

    // --- VẠN BẢO LÂU (SÀN GIAO DỊCH) ---
    else if (action === 'vanbaolaunav') {
      const activeListings = db.prepare(`
        SELECT m.*, u.name as seller_name, t.name as item_name, t.rarity as item_rarity
        FROM market_listings m
        JOIN users u ON m.seller_id = u.discord_id
        JOIN items t ON m.item_id = t.id
        WHERE m.status = 'active'
        ORDER BY m.listed_at DESC
        LIMIT 10
      `).all() as any[];

      const embed = new EmbedBuilder()
        .setTitle('🏛️ VẠN BẢO LÂU - SÀN GIAO DỊCH PHƯỜNG THỊ')
        .setColor(EMBED_COLORS.ORANGE)
        .setDescription('Nơi giao lưu vật phẩm tự do giữa các tu sĩ. Mọi giao dịch chịu 5% thuế bảo hộ tông môn.')
        .setFooter({ text: 'Dùng /vanbaolau ban | mua | huy để giao dịch chi tiết.' })
        .setTimestamp();

      if (activeListings.length === 0) {
        embed.addFields({ name: '📜 Tin Đăng Bán', value: '*Hiện chưa có tu sĩ nào treo bán linh vật. Hãy là người đầu tiên!*' });
      } else {
        for (const listing of activeListings) {
          embed.addFields({
            name: `ID Tin: \`#${listing.id}\` - ${listing.item_name} x${listing.quantity} [${(listing.item_rarity || '').toUpperCase()}]`,
            value: `• Người bán: **${listing.seller_name}**\n• Giá: **${listing.price}** Hạ Phẩm Linh Thạch\n• Mua: \`/vanbaolau mua listing_id: ${listing.id}\``
          });
        }
      }

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`hosoback_${targetUserId}`)
          .setLabel('🔙 Quay Lại Hồ Sơ')
          .setStyle(ButtonStyle.Secondary)
      );
      await safeV2Update(interaction, [embed], [backRow]);
    }

    // --- TRADE (DELEGATE) ---
    else if (action === 'trade') {
      const { TradeInteractionHandler } = require('../interactions/TradeInteractionHandler');
      await TradeInteractionHandler.handle(interaction as any, action, parts, targetUserId);
      return;
    }

  } catch (e) {
    console.error(`[MarketHandler] Lỗi xử lý action ${action}:`, e);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Có lỗi xảy ra!', flags: MessageFlags.Ephemeral });
      } else if (interaction.isRepliable()) {
        await interaction.followUp({ content: '❌ Có lỗi xảy ra!', flags: MessageFlags.Ephemeral });
      }
    } catch (_) {}
  }
}
