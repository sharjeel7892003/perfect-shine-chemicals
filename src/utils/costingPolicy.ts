import { calculateWeightedAverageLandedCost } from './freightAllocation';

export type RawMaterialCostingMethod = 'latest_purchase_price' | 'weighted_average';

/**
 * System-wide costing method configuration for Raw Materials.
 * 
 * - 'latest_purchase_price': Active Master Rate (cost_per_unit) equals the landed cost
 *   per unit of the MOST RECENT purchase date (including freight/trip allocation).
 *   Backdated purchases do NOT overwrite newer rates.
 * - 'weighted_average': Active Master Rate blends previous stock valuation with incoming purchase.
 */
export const ACTIVE_RAW_MATERIAL_COSTING_METHOD: RawMaterialCostingMethod = 'latest_purchase_price';

export interface ResolveNextRawMaterialCostParams {
  currentStock: number;
  currentCostPerUnit: number;
  incomingQuantity: number;
  incomingLandedCost: number;
  incomingPurchaseDate: string;
  existingPurchases?: {
    date: string;
    items?: { raw_material_id?: string; landed_cost?: number; unit_cost?: number }[];
  }[];
  rawMaterialId?: string;
  costingMethod?: RawMaterialCostingMethod;
}

/**
 * Determines the updated Active Master Rate (cost_per_unit) for a raw material upon a purchase intake.
 *
 * Costing Rules:
 * 1. 'latest_purchase_price' (Active Default):
 *    - If the incoming purchase date is >= latest recorded purchase date for this raw material,
 *      Active Master Rate immediately becomes this purchase's unit landed cost.
 *    - If the incoming purchase is backdated (an existing purchase exists with a later purchase date),
 *      it does NOT overwrite the newer rate.
 * 2. 'weighted_average':
 *    - Uses standard volume-weighted blending with previous stock.
 */
export function resolveNextRawMaterialCost({
  currentStock,
  currentCostPerUnit,
  incomingQuantity,
  incomingLandedCost,
  incomingPurchaseDate,
  existingPurchases = [],
  rawMaterialId,
  costingMethod = ACTIVE_RAW_MATERIAL_COSTING_METHOD,
}: ResolveNextRawMaterialCostParams): number {
  if (costingMethod === 'weighted_average') {
    return calculateWeightedAverageLandedCost(
      currentStock,
      currentCostPerUnit,
      incomingQuantity,
      incomingLandedCost
    );
  }

  // Mode: 'latest_purchase_price'
  const incomingLanded = Math.max(0, Number(incomingLandedCost || 0));
  if (incomingQuantity <= 0 && incomingLanded <= 0) {
    return Number(currentCostPerUnit || 0);
  }

  // Check if incoming purchase is backdated compared to existing purchases for this raw material
  if (rawMaterialId && existingPurchases.length > 0 && incomingPurchaseDate) {
    const incomingTime = new Date(incomingPurchaseDate).getTime();

    const hasNewerPurchase = existingPurchases.some(p => {
      if (!p.date) return false;
      const pTime = new Date(p.date).getTime();
      if (pTime > incomingTime) {
        return p.items?.some(it => it.raw_material_id === rawMaterialId);
      }
      return false;
    });

    if (hasNewerPurchase) {
      // Older backdated purchase must not overwrite the newer rate
      return Number(currentCostPerUnit || 0);
    }
  }

  // Incoming purchase is the most recent (or only) purchase: landed cost becomes the master rate
  return Number(incomingLanded.toFixed(2));
}

/**
 * Finds the unit landed cost of the most recent purchase for a raw material.
 * Returns null if no purchases exist for that raw material.
 */
export function findLatestPurchaseRate(
  rawMaterialId: string,
  purchases: {
    date: string;
    items?: { raw_material_id?: string; landed_cost?: number; unit_cost?: number; quantity?: number; allocated_freight?: number }[];
  }[]
): number | null {
  const matchingPurchases = purchases
    .filter(p => p.items?.some(it => it.raw_material_id === rawMaterialId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (matchingPurchases.length === 0) return null;

  const latestPurchase = matchingPurchases[0];
  const item = latestPurchase.items?.find(it => it.raw_material_id === rawMaterialId);
  if (!item) return null;

  const qty = Number(item.quantity || 0);
  const landed = item.landed_cost !== undefined
    ? Number(item.landed_cost)
    : (qty > 0 ? Number(item.unit_cost || 0) + (Number(item.allocated_freight || 0) / qty) : Number(item.unit_cost || 0));

  return Number(Number(landed).toFixed(2));
}
