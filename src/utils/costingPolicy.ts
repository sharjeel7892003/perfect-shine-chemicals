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
    const incomingDay = incomingPurchaseDate.slice(0, 10);

    const hasNewerPurchase = existingPurchases.some(p => {
      if (!p.date) return false;
      const pDay = p.date.slice(0, 10);
      if (pDay > incomingDay) {
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
 * Finds the unit landed cost of the most recent purchase for a raw material:
 * (material cost + allocated freight) / quantity.
 * Returns null if no purchases exist for that raw material.
 */
export function findLatestPurchaseRate(
  rawMaterialId: string,
  purchases: {
    date: string;
    created_at?: string;
    items?: {
      raw_material_id?: string;
      landed_cost?: number;
      unit_cost?: number;
      quantity?: number;
      subtotal?: number;
      allocated_freight?: number;
    }[];
  }[]
): number | null {
  const matchingPurchases = purchases
    .filter(p => p.items?.some(it => it.raw_material_id === rawMaterialId))
    .sort((a, b) => {
      const dayA = (a.date || '').slice(0, 10);
      const dayB = (b.date || '').slice(0, 10);
      if (dayA !== dayB) {
        return dayB.localeCompare(dayA);
      }
      const timeA = new Date(a.created_at || a.date || 0).getTime();
      const timeB = new Date(b.created_at || b.date || 0).getTime();
      return timeB - timeA;
    });

  if (matchingPurchases.length === 0) return null;

  const latestPurchase = matchingPurchases[0];
  const matchingItems = (latestPurchase.items || []).filter(it => it.raw_material_id === rawMaterialId);
  if (matchingItems.length === 0) return null;

  let totalQty = 0;
  let totalLandedAmount = 0;

  for (const item of matchingItems) {
    const qty = Number(item.quantity || 0);
    const unitCost = Number(item.unit_cost || 0);
    const materialCost = item.subtotal !== undefined && Number(item.subtotal) > 0
      ? Number(item.subtotal)
      : qty * unitCost;
    const allocatedFreight = item.allocated_freight !== undefined
      ? Number(item.allocated_freight || 0)
      : (item.landed_cost !== undefined && qty > 0
          ? Math.max(0, (Number(item.landed_cost) - unitCost) * qty)
          : 0);

    totalQty += qty;
    totalLandedAmount += materialCost + allocatedFreight;
  }

  const landed = totalQty > 0
    ? totalLandedAmount / totalQty
    : (matchingItems[0].landed_cost !== undefined
        ? Number(matchingItems[0].landed_cost)
        : Number(matchingItems[0].unit_cost || 0));

  return Number(Number(landed).toFixed(2));
}
