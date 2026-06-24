export interface WorldBossEntity {
  id: string;
  name: string;
  level: number;
  hp: number;
  max_hp: number;
  atk: number;
  def: number;
  crit: number;
  critRes: number;
  status: 'active' | 'defeated';
  last_spawned_at: number;
  defeated_at: number | null;
  defeated_by: string | null;
  phase: number;
  current_weakness: string;
}

export interface PetEntity {
  id: number;
  user_id: string;
  name: string;
  element: string;
  level: number;
  exp: number;
  base_atk: number;
  loyalty: number;
  is_deployed: number; // 0 or 1
  created_at: number;
}

export interface MarketListingEntity {
  id: number;
  seller_id: string;
  item_id: string;
  quantity: number;
  price_ha_pham: number;
  created_at: number;
}
