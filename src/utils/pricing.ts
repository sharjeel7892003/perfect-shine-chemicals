import { SaleItem, Sale, Product } from '../types';

/**
 * Resolves the catalog/standard unit selling price for a line item.
 * Prioritizes item.default_unit_price if recorded at addition time,
 * or dynamically resolves from the current product / pack size definition.
 */
export const getStandardUnitPrice = (
  item: SaleItem,
  products: Product[]
): number | undefined => {
  if (item.default_unit_price !== undefined && item.default_unit_price > 0) {
    return item.default_unit_price;
  }

  const product = products.find(p => p.id === item.product_id);
  if (!product) return undefined;

  if (item.pack_size_id && item.pack_size_id !== 'bulk') {
    const pack = product.pack_sizes?.find(p => p.id === item.pack_size_id);
    if (pack && pack.selling_price !== undefined) {
      return pack.selling_price;
    }
  }

  return product.selling_price;
};

export interface RateDifferenceInfo {
  isCustom: boolean;
  diff: number;
  standardPrice?: number;
  isDiscount: boolean;
  isPremium: boolean;
}

/**
 * Checks whether the actual selling unit_price on a sale item
 * differs from the standard catalog selling price.
 */
export const getRateDifferenceInfo = (
  item: SaleItem,
  products: Product[]
): RateDifferenceInfo => {
  const standardPrice = getStandardUnitPrice(item, products);
  if (standardPrice === undefined) {
    return {
      isCustom: false,
      diff: 0,
      standardPrice: undefined,
      isDiscount: false,
      isPremium: false,
    };
  }

  const actualPrice = Number(item.unit_price || 0);
  const diff = Number((actualPrice - standardPrice).toFixed(2));
  const isCustom = Math.abs(diff) > 0.001;

  return {
    isCustom,
    diff,
    standardPrice,
    isDiscount: isCustom && diff < 0,
    isPremium: isCustom && diff > 0,
  };
};

/**
 * Checks if any item in a sale has a custom negotiated rate
 */
export const saleHasCustomRates = (
  sale: Sale,
  products: Product[]
): boolean => {
  return (sale.items || []).some(item => getRateDifferenceInfo(item, products).isCustom);
};
