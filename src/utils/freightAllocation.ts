import { RawMaterialUnit } from '../types';

export interface TripAllocationItemInput {
  id?: string;
  supplier_id?: string;
  supplier_name?: string;
  raw_material_id?: string;
  raw_material_name?: string;
  product_or_material_name?: string;
  unit: RawMaterialUnit | string;
  quantity: number;
  unit_cost: number;
  subtotal?: number;
}

export interface AllocatedTripItemResult extends TripAllocationItemInput {
  subtotal: number;
  is_weight_allocated: boolean;
  allocation_percentage: number; // e.g. 35.0 for 35%
  allocated_freight: number; // Share of transport cost in PKR
  landed_cost: number; // Unit landed cost = unit_cost + (allocated_freight / quantity)
  total_landed_cost: number; // subtotal + allocated_freight
}

/**
 * Checks whether an item's unit qualifies as a weight/liquid measurement (kg or liter)
 */
export const isWeightOrLiquidUnit = (unit?: string): boolean => {
  if (!unit) return false;
  const normalized = unit.toLowerCase().trim();
  return (
    normalized === 'kg' ||
    normalized === 'liter' ||
    normalized === 'litre' ||
    normalized === 'l'
  );
};

/**
 * Proportional freight allocator for purchase trips
 * Distributes total transport cost across items based on quantity/weight.
 * 'pcs' items are excluded by default unless includePcs is true or all items are pcs.
 */
export const allocateTripFreight = (
  items: TripAllocationItemInput[],
  totalTransportCost: number,
  includePcs: boolean = false
): {
  allocatedItems: AllocatedTripItemResult[];
  totalAllocatableWeight: number;
  totalMaterialCost: number;
  totalTransportAllocated: number;
  grandTotal: number;
  hasPcsExcluded: boolean;
} => {
  const safeTransportCost = Math.max(0, Number(totalTransportCost) || 0);

  // Check if there are any weight/liquid items
  const weightItemsCount = items.filter(it => isWeightOrLiquidUnit(it.unit) && Number(it.quantity) > 0).length;
  
  // If user didn't check includePcs, but there are ZERO weight items and only pcs items,
  // we automatically include pcs so transport isn't unallocated.
  const shouldIncludePcs = includePcs || (weightItemsCount === 0 && items.length > 0);

  // Determine eligibility per item
  const itemEligibility = items.map(item => {
    const isEligible = shouldIncludePcs || isWeightOrLiquidUnit(item.unit);
    return {
      item,
      isEligible: isEligible && Number(item.quantity) > 0,
      qty: Math.max(0, Number(item.quantity) || 0),
      rate: Math.max(0, Number(item.unit_cost) || 0),
    };
  });

  const totalAllocatableWeight = itemEligibility.reduce((sum, el) => {
    return el.isEligible ? sum + el.qty : sum;
  }, 0);

  let remainingFreight = safeTransportCost;
  let totalMaterialCost = 0;
  let eligibleCount = itemEligibility.filter(el => el.isEligible).length;

  const preAllocated = itemEligibility.map((el, index) => {
    const subtotal = Number((el.qty * el.rate).toFixed(2));
    totalMaterialCost += subtotal;

    let allocatedFreight = 0;
    let percentage = 0;

    if (el.isEligible && totalAllocatableWeight > 0 && safeTransportCost > 0) {
      percentage = Number(((el.qty / totalAllocatableWeight) * 100).toFixed(2));
      // For all but the last eligible item, calculate proportional share
      allocatedFreight = Number(((el.qty / totalAllocatableWeight) * safeTransportCost).toFixed(2));
    }

    return {
      ...el.item,
      subtotal,
      is_weight_allocated: el.isEligible,
      allocation_percentage: percentage,
      allocated_freight: allocatedFreight,
      quantity: el.qty,
      unit_cost: el.rate,
    };
  });

  // Reconcile rounding discrepancies on the last eligible item so sum === safeTransportCost
  if (safeTransportCost > 0 && totalAllocatableWeight > 0) {
    const sumAllocated = preAllocated.reduce((sum, it) => sum + it.allocated_freight, 0);
    const discrepancy = Number((safeTransportCost - sumAllocated).toFixed(2));

    if (Math.abs(discrepancy) > 0) {
      // Find the eligible item with largest quantity to absorb rounding discrepancy
      const eligibleIndices = preAllocated
        .map((it, idx) => ({ it, idx }))
        .filter(entry => entry.it.is_weight_allocated);

      if (eligibleIndices.length > 0) {
        eligibleIndices.sort((a, b) => b.it.quantity - a.it.quantity);
        const targetIdx = eligibleIndices[0].idx;
        preAllocated[targetIdx].allocated_freight = Number(
          (preAllocated[targetIdx].allocated_freight + discrepancy).toFixed(2)
        );
      }
    }
  }

  // Calculate final unit landed cost and total landed cost
  const allocatedItems: AllocatedTripItemResult[] = preAllocated.map(it => {
    const landedPerUnit = it.quantity > 0 
      ? Number((it.unit_cost + (it.allocated_freight / it.quantity)).toFixed(2))
      : it.unit_cost;
    const totalLanded = Number((it.subtotal + it.allocated_freight).toFixed(2));

    return {
      ...it,
      landed_cost: landedPerUnit,
      total_landed_cost: totalLanded,
    };
  });

  const totalTransportAllocated = allocatedItems.reduce((acc, it) => acc + it.allocated_freight, 0);
  const grandTotal = Number((totalMaterialCost + totalTransportAllocated).toFixed(2));
  const hasPcsExcluded = items.some(it => !isWeightOrLiquidUnit(it.unit)) && !shouldIncludePcs;

  return {
    allocatedItems,
    totalAllocatableWeight,
    totalMaterialCost: Number(totalMaterialCost.toFixed(2)),
    totalTransportAllocated: Number(totalTransportAllocated.toFixed(2)),
    grandTotal,
    hasPcsExcluded,
  };
};

/**
 * Authoritative Weighted Average Landed Cost calculation
 * Integrates previous inventory on hand and the new purchase batch.
 *
 * Formula:
 * If currentStock <= 0:
 *   weightedAvg = newLandedCost
 * If currentStock > 0:
 *   weightedAvg = ((currentStock * currentUnitCost) + (newQuantity * newLandedCost)) / (currentStock + newQuantity)
 */
export const calculateWeightedAverageLandedCost = (
  currentStock: number,
  currentUnitCost: number,
  newQuantity: number,
  newLandedCost: number
): number => {
  const stock = Number(currentStock || 0);
  const currCost = Number(currentUnitCost || 0);
  const addQty = Math.max(0, Number(newQuantity || 0));
  const addLanded = Math.max(0, Number(newLandedCost || 0));

  if (addQty <= 0) return currCost;

  if (stock <= 0) {
    // If no previous stock exists or stock was negative, the new rate becomes the master rate
    return Number(addLanded.toFixed(2));
  }

  const existingValuation = stock * currCost;
  const incomingValuation = addQty * addLanded;
  const totalCombinedStock = stock + addQty;

  if (totalCombinedStock <= 0) return Number(addLanded.toFixed(2));

  const weightedAvg = (existingValuation + incomingValuation) / totalCombinedStock;
  return Number(weightedAvg.toFixed(2));
};
