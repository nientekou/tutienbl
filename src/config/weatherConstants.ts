// B-06: Weather System Constants

export type WeatherType = 'sunny' | 'rainy' | 'stormy' | 'night' | 'foggy' | 'snowy';

export interface WeatherDef {
  id: WeatherType;
  name: string;
  emoji: string;
  description: string;
  effects: { stat: string; value: number }[];
  duration: number; // hours
  rarity: number; // weight for random selection
}

export const WEATHERS: Record<WeatherType, WeatherDef> = {
  sunny: {
    id: 'sunny',
    name: 'Nắng Ấm',
    emoji: '☀️',
    description: 'Trời nắng ấm, tu luyện thuận lợi',
    effects: [{ stat: 'exp_bonus', value: 0.05 }],
    duration: 6,
    rarity: 30,
  },
  rainy: {
    id: 'rainy',
    name: 'Mưa Rào',
    emoji: '🌧️',
    description: 'Mưa rơi tầm tã, phòng thủ tăng nhưng tấn công giảm',
    effects: [
      { stat: 'atk_bonus', value: -0.05 },
      { stat: 'def_bonus', value: 0.05 },
    ],
    duration: 6,
    rarity: 25,
  },
  stormy: {
    id: 'stormy',
    name: 'Bão Tố',
    emoji: '⛈️',
    description: 'Bão giật mạnh, Lôi hệ mạnh nhưng tốc độ chậm',
    effects: [
      { stat: 'loi_damage_bonus', value: 0.10 },
      { stat: 'speed_bonus', value: -0.10 },
    ],
    duration: 4,
    rarity: 10,
  },
  night: {
    id: 'night',
    name: 'Đêm Yên',
    emoji: '🌙',
    description: 'Đêm thanh vắng, thiền định tăng hiệu quả',
    effects: [
      { stat: 'meditation_exp_bonus', value: 0.10 },
      { stat: 'dodge_bonus', value: -0.05 },
    ],
    duration: 8,
    rarity: 20,
  },
  foggy: {
    id: 'foggy',
    name: 'Sương Mù',
    emoji: '🌫️',
    description: 'Sương mù dày đặc, khó nhìn thấy — né tránh tăng',
    effects: [
      { stat: 'dodge_bonus', value: 0.08 },
      { stat: 'crit_bonus', value: -0.03 },
    ],
    duration: 4,
    rarity: 10,
  },
  snowy: {
    id: 'snowy',
    name: 'Tuyết Rơi',
    emoji: '❄️',
    description: 'Tuyết rơi trắng trời, Thủy hệ mạnh',
    effects: [
      { stat: 'thuy_damage_bonus', value: 0.08 },
      { stat: 'speed_bonus', value: -0.05 },
    ],
    duration: 6,
    rarity: 5,
  },
};

export const WEATHER_CHANGE_INTERVAL_HOURS = 6;
export const WEATHER_EFFECT_CAP = 0.10; // Max ±10% from weather
