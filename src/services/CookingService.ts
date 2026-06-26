import { userRepository } from '../database/repositories/UserRepository';

// A-04: Cooking System

interface RecipeDef {
  id: string;
  name: string;
  description: string;
  ingredients: { itemId: string; quantity: number }[];
  effect: { type: string; value: number; duration: number };
  unlockLevel: number;
}

const RECIPES: RecipeDef[] = [
  { id: 'recipe_herb_salad', name: 'Rau Sâm', description: '+5% EXP 30 phút', ingredients: [{ itemId: 'herb_1', quantity: 2 }], effect: { type: 'exp_bonus', value: 0.05, duration: 30 }, unlockLevel: 1 },
  { id: 'recipe_meat_feast', name: 'Yến Tiệc', description: '+10% ATK 30 phút', ingredients: [{ itemId: 'meat_1', quantity: 3 }], effect: { type: 'atk_bonus', value: 0.10, duration: 30 }, unlockLevel: 5 },
  { id: 'recipe_fish_soup', name: 'Canh Cá', description: '+10% DEF 30 phút', ingredients: [{ itemId: 'fish_1', quantity: 2 }], effect: { type: 'def_bonus', value: 0.10, duration: 30 }, unlockLevel: 5 },
  { id: 'recipe_elixir_soup', name: 'Canh Linh Lung', description: '+15% EXP 30 phút', ingredients: [{ itemId: 'herb_rare', quantity: 1 }, { itemId: 'fish_rare', quantity: 1 }], effect: { type: 'exp_bonus', value: 0.15, duration: 30 }, unlockLevel: 10 },
  { id: 'recipe_dragon_fruit', name: 'Quả Rồng', description: '+20% ATK+DEF 30 phút', ingredients: [{ itemId: 'herb_legendary', quantity: 1 }, { itemId: 'fire_stone', quantity: 1 }], effect: { type: 'all_bonus', value: 0.20, duration: 30 }, unlockLevel: 15 },
  { id: 'recipe_immortal', name: 'Tiên Đan', description: 'Hồi sinh 1 lần trong chiến đấu', ingredients: [{ itemId: 'tinh_thach_shard', quantity: 2 }, { itemId: 'herb_legendary', quantity: 1 }], effect: { type: 'revive', value: 1, duration: 1 }, unlockLevel: 20 },
];

class CookingService {
  /**
   * A-04: Get available recipes
   */
  getRecipes(userId: string): { recipe: RecipeDef; unlocked: boolean }[] {
    const user = userRepository.get(userId);
    const level = user?.level || 1;

    return RECIPES.map(r => ({
      recipe: r,
      unlocked: level >= r.unlockLevel
    }));
  }

  /**
   * A-04: Cook a recipe
   */
  cook(userId: string, recipeId: string): { success: boolean; message: string; effect?: { type: string; value: number; duration: number } } {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return { success: false, message: 'Công thức không tồn tại!' };

    const user = userRepository.get(userId);
    if (!user) return { success: false, message: 'Người dùng không tồn tại!' };

    if (user.level < recipe.unlockLevel) {
      return { success: false, message: `Cần cấp ${recipe.unlockLevel} (hiện tại: ${user.level})` };
    }

    if (user.coin_ha_pham < 100) {
      return { success: false, message: 'Không đủ nguyên liệu!' };
    }

    // Consume materials
    userRepository.update(userId, { coin_ha_pham: user.coin_ha_pham - 100 });

    return {
      success: true,
      message: `Cooked **${recipe.name}**! ${recipe.description}`,
      effect: recipe.effect
    };
  }

  /**
   * A-04: Get cooking description
   */
  getCookingDescription(userId: string): string {
    const recipes = this.getRecipes(userId);

    let msg = `🍳 **Nấu Nướng**\n`;
    msg += `📊 Công thức đã mở: **${recipes.filter(r => r.unlocked).length}**/${recipes.length}\n\n`;

    msg += `**Công thức:**\n`;
    for (const r of recipes) {
      msg += `${r.unlocked ? '✅' : '🔒'} **${r.recipe.name}**: ${r.recipe.description}\n`;
      if (!r.unlocked) msg += `   Mở khoá: Cấp ${r.recipe.unlockLevel}\n`;
    }

    return msg;
  }
}

export const cookingService = new CookingService();
