// B-06: Weather System Constants

export type WeatherType = 'sunny' | 'rainy' | 'stormy' | 'night' | 'foggy' | 'snowy' | 'loi_ma_vu' | 'hoa_hai_trieu' | 'bang_ha_ky';

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
  // V17 B-02: 3 planned weather types
  loi_ma_vu: {
    id: 'loi_ma_vu',
    name: 'Lôi Ma Vũ',
    emoji: '🌩️',
    description: 'Mưa bão sấm sét, tu luyện Lôi Kiếp hiệu quả',
    effects: [
      { stat: 'loi_damage_bonus', value: 0.10 },
      { stat: 'atk_bonus', value: 0.10 },
      { stat: 'tribulation_exp_bonus', value: 0.50 },
    ],
    duration: 4,
    rarity: 8,
  },
  hoa_hai_trieu: {
    id: 'hoa_hai_trieu',
    name: 'Hỏa Hải Triều',
    emoji: '🌋',
    description: 'Thủy triều lửa cuộn trào, luyện đan thành công cao',
    effects: [
      { stat: 'alchemy_bonus', value: 0.20 },
      { stat: 'atk_bonus', value: 0.05 },
      { stat: 'def_bonus', value: -0.10 },
    ],
    duration: 4,
    rarity: 7,
  },
  bang_ha_ky: {
    id: 'bang_ha_ky',
    name: 'Băng Hà Kỳ',
    emoji: '🧊',
    description: 'Băng giá phủ trời đất, khoáng thạch quý hiếm xuất hiện',
    effects: [
      { stat: 'speed_bonus', value: -0.20 },
      { stat: 'drop_bonus', value: 0.25 },
      { stat: 'def_bonus', value: 0.15 },
    ],
    duration: 6,
    rarity: 5,
  },
};

export const WEATHER_CHANGE_INTERVAL_HOURS = 6;
export const WEATHER_EFFECT_CAP = 0.10; // Max ±10% from weather
