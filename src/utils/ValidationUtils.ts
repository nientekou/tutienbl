import { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction, InteractionReplyOptions } from 'discord.js';

export class ValidationUtils {
  /**
   * Xác thực chủ sở hữu của tin nhắn có trùng khớp với người nhấn nút/menu không.
   * Ngăn chặn người dùng lạ nhấn nút của người khác.
   * @param interaction Tương tác Button/Select/Modal
   * @param targetUserId ID của chủ sở hữu được phép tương tác
   * @param showWarning Có hiển thị cảnh báo cho người nhấn hay không (Mặc định: true)
   * @returns true nếu hợp lệ, false nếu không hợp lệ
   */
  public static async verifyOwnership(
    interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
    targetUserId: string,
    showWarning: boolean = true
  ): Promise<boolean> {
    if (interaction.user.id !== targetUserId) {
      if (showWarning) {
        const payload: InteractionReplyOptions = {
          content: '❌ Nút bấm / Tương tác này không dành cho đạo hữu!',
          ephemeral: true
        };

        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload);
          } else {
            await interaction.reply(payload);
          }
        } catch (err: any) {
          // Bỏ qua nếu interaction đã hết hạn (10062) hoặc đã acknowledged (40060)
          if (err?.code !== 10062 && err?.code !== 40060 &&
              err?.rawError?.code !== 10062 && err?.rawError?.code !== 40060) {
            console.error('[ValidationUtils] Lỗi khi gửi cảnh báo ownership:', err);
          }
        }
      }
      return false;
    }
    return true;
  }

  /**
   * Kiểm tra định dạng ID có phải là Snowflake ID hợp lệ của Discord hay không.
   * Ngăn chặn việc truyền mã độc vào customId.
   */
  public static isValidSnowflake(id: string): boolean {
    return /^[0-9]{17,20}$/.test(id);
  }
}
