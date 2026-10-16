import React, { useState, useMemo } from 'react';
import {
  Scale,
  Calendar,
  Filter,
  Download,
  Printer,
  TrendingUp,
  Package,
  Layers,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Boxes,
  FlaskConical,
  Info,
  Tag
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { exportToCSV } from '../../utils/batchNumber';
import { Badge } from '../common/Badge';
import { Product, Sale, ProductionBatch, SalesReturn } from '../../types';

interface ProductionVolumeReportViewProps {
  embedded?: boolean;
}

export const ProductionVolumeReportView: React.FC<ProductionVolumeReportViewProps> = ({ embedded = false }) => {
  const { products, productionBatches, sales, rawMaterials, salesReturns } = useApp();

  // Filters State
  const [filterMode, setFilterMode] = useState<'month' | 'year' | 'custom' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [brandFilter, setBrandFilter] = useState<'all' | 'own' | 'private_label'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all distinct months available in data for the month selector
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonth);

    (productionBatches || []).forEach(b => {
      if (b.date) monthsSet.add(b.date.slice(0, 7));
    });
    (sales || []).forEach(s => {
      if (s.date) monthsSet.add(s.date.slice(0, 7));
    });

    return Array.from(monthsSet).sort().reverse();
  }, [productionBatches, sales]);

  // Extract all distinct years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    const currentYear = String(new Date().getFullYear());
    yearsSet.add(currentYear);

    availableMonths.forEach(m => {
      const y = m.slice(0, 4);
      if (y) yearsSet.add(y);
    });

    return Array.from(yearsSet).sort().reverse();
  }, [availableMonths]);

  // Format month label
  const formatMonthLabel = (mStr: string) => {
    if (!mStr || mStr.length < 7) return mStr;
    const [year, month] = mStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Date filter checker
  const isDateInFilter = (dateStr?: string) => {
    if (!dateStr) return false;
    const dStr = dateStr.slice(0, 10);

    if (filterMode === 'all') return true;

    if (filterMode === 'month') {
      return dStr.startsWith(selectedMonth);
    }

    if (filterMode === 'year') {
      return dStr.startsWith(selectedYear);
    }

    if (filterMode === 'custom') {
      if (customStartDate && dStr < customStartDate) return false;
      if (customEndDate && dStr > customEndDate) return false;
      return true;
    }

    return true;
  };

  // Helper: Format weight in KG (up to 3 decimals)
  const formatKg = (val: number): string => {
    return Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }) + ' kg';
  };

  // Helper: Format weight in Tons (1 ton = 1,000 kg, up to 3 decimals)
  const formatTons = (valInKg: number): string => {
    const tons = (Number(valInKg || 0) / 1000);
    return tons.toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }) + ' tons';
  };

  // Helper to get effective density for a product
  const getProductDensity = (product?: Product | null, baseUnit?: string): number => {
    if (!product) {
      return (baseUnit === 'kg' ? 1.0 : 1.0);
    }
    const isKg = product.base_unit === 'kg' || product.unit === 'kg';
    if (isKg) return 1.0;
    return Number(product.density) > 0 ? Number(product.density) : 1.0;
  };

  // Map products by ID and lowercase name for fast lookup
  const productMapById = useMemo(() => {
    const map = new Map<string, Product>();
    (products || []).forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const productMapByName = useMemo(() => {
    const map = new Map<string, Product>();
    (products || []).forEach(p => map.set(p.name.trim().toLowerCase(), p));
    return map;
  }, [products]);

  // Brand filter checker for products
  const matchesBrandFilter = (product?: Product | null, isPLSaleItem?: boolean): boolean => {
    if (brandFilter === 'all') return true;
    const isPrivateLabel = Boolean(product?.is_private_label || isPLSaleItem);
    if (brandFilter === 'own') return !isPrivateLabel;
    if (brandFilter === 'private_label') return isPrivateLabel;
    return true;
  };

  // Active / Filtered Products List
  const displayProducts = useMemo(() => {
    return (products || []).filter(p => {
      if (p.is_archived) return false;
      if (brandFilter === 'own' && p.is_private_label) return false;
      if (brandFilter === 'private_label' && !p.is_private_label) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, brandFilter, searchQuery]);

  // ============================================================================
  // AUTHORITATIVE CALCULATIONS
  // ============================================================================
  const reportData = useMemo(() => {
    // 1. FILTERED PRODUCTION BATCHES (Production batches only, excluding Packing Runs)
    const validBatches = (productionBatches || []).filter(b => {
      if (!isDateInFilter(b.date)) return false;
      const linkedProd = b.product_id ? productMapById.get(b.product_id) : productMapByName.get(b.product_name.trim().toLowerCase());
      if (!matchesBrandFilter(linkedProd)) return false;
      return true;
    });

    // 2. FILTERED SALES & SALE ITEMS (Finished goods vs Raw material resale)
    const validSales = (sales || []).filter(s => {
      if (s.is_archived) return false;
      if (!isDateInFilter(s.date)) return false;
      return true;
    });

    // Sales returns in filter period
    const validReturns = (salesReturns || []).filter(ret => {
      if (!isDateInFilter(ret.date)) return false;
      return true;
    });

    // Per-Product accumulator
    const productStatsMap: Record<string, {
      product: Product | null;
      productName: string;
      productId: string;
      category: string;
      baseUnit: string;
      density: number;
      isPrivateLabel: boolean;
      producedKg: number;
      batchCount: number;
      soldBulkKg: number;
      soldBottleKg: number;
      soldBoxKg: number;
      soldTotalKg: number;
      returnedKg: number;
      netSoldKg: number;
      currentBulkStockKg: number;
      currentPackedStockKg: number;
      currentTotalStockKg: number;
    }> = {};

    // Helper to get or init accumulator row
    const getProductRow = (prodId?: string, prodName?: string, unitHint?: string) => {
      const p = prodId ? productMapById.get(prodId) : (prodName ? productMapByName.get(prodName.trim().toLowerCase()) : null);
      const resolvedId = p?.id || prodId || prodName || 'unknown';
      const resolvedName = p?.name || prodName || 'Unknown Product';

      if (!productStatsMap[resolvedId]) {
        const baseUnit = p?.base_unit || (p?.unit === 'kg' ? 'kg' : (unitHint === 'kg' ? 'kg' : 'liter'));
        const density = getProductDensity(p, baseUnit);

        // Calculate CURRENT physical stock on hand from products catalog
        let currentBulkStockKg = 0;
        let currentPackedStockKg = 0;

        if (p) {
          const isKg = p.base_unit === 'kg' || p.unit === 'kg';
          currentBulkStockKg = Number(p.current_stock || 0) * (isKg ? 1.0 : density);

          (p.pack_sizes || []).forEach(ps => {
            const pQty = Number(ps.packed_stock || 0);
            const pSize = Number(ps.size_in_base_unit || 1);
            const pKg = pQty * pSize * (isKg ? 1.0 : density);
            currentPackedStockKg += pKg;
          });
        }

        productStatsMap[resolvedId] = {
          product: p || null,
          productName: resolvedName,
          productId: resolvedId,
          category: p?.category || 'General',
          baseUnit,
          density,
          isPrivateLabel: Boolean(p?.is_private_label),
          producedKg: 0,
          batchCount: 0,
          soldBulkKg: 0,
          soldBottleKg: 0,
          soldBoxKg: 0,
          soldTotalKg: 0,
          returnedKg: 0,
          netSoldKg: 0,
          currentBulkStockKg,
          currentPackedStockKg,
          currentTotalStockKg: currentBulkStockKg + currentPackedStockKg,
        };
      }
      return productStatsMap[resolvedId];
    };

    // Pre-populate all matching products in the catalog so even 0-activity products are visible
    displayProducts.forEach(p => {
      getProductRow(p.id, p.name, p.base_unit || p.unit);
    });

    // Accumulate Produced Volume (From Production Batches)
    let totalProducedKg = 0;
    let totalBatchesCount = 0;

    validBatches.forEach(batch => {
      const row = getProductRow(batch.product_id, batch.product_name, batch.base_unit);
      const isKg = row.baseUnit === 'kg';
      const qtyProduced = Number(batch.quantity_produced || 0);
      const weightKg = isKg ? qtyProduced : (qtyProduced * row.density);

      row.producedKg += weightKg;
      row.batchCount += 1;
      totalProducedKg += weightKg;
      totalBatchesCount += 1;
    });

    // Accumulate Sold Volume (From Sale Items)
    let totalManufacturedSoldKg = 0;
    let totalRawMaterialResaleKg = 0;
    let totalBulkSoldKg = 0;
    let totalBottleSoldKg = 0;
    let totalBoxSoldKg = 0;

    validSales.forEach(sale => {
      // Parse PL_DATA if available in notes for dedicated box sales metadata
      let plMetaItems: any[] = [];
      if (sale.notes && sale.notes.includes('<!--PL_DATA:')) {
        const match = sale.notes.match(/<!--PL_DATA:(.*?)-->/);
        if (match && match[1]) {
          try {
            const parsed = JSON.parse(match[1]);
            plMetaItems = parsed.items || [];
          } catch (e) {
            console.warn('Could not parse PL_DATA:', e);
          }
        }
      }

      (sale.items || []).forEach((item, idx) => {
        // Exclude / separate raw material resale (e.g. LABSA 96%)
        const isRawMaterial = item.item_type === 'raw_material' ||
          (!item.product_id && Boolean(item.raw_material_id)) ||
          rawMaterials.some(rm => rm.id === item.raw_material_id || rm.name.toLowerCase() === item.product_name.toLowerCase());

        if (isRawMaterial) {
          const rmQty = Number(item.base_quantity || item.quantity || 0);
          totalRawMaterialResaleKg += rmQty;
          return;
        }

        // Finished Good Sale Item
        const linkedProd = item.product_id ? productMapById.get(item.product_id) : productMapByName.get(item.product_name.trim().toLowerCase());
        const isPLSale = Boolean(item.is_private_label || sale.is_private_label || (linkedProd && linkedProd.is_private_label));
        if (!matchesBrandFilter(linkedProd, isPLSale)) return;

        const row = getProductRow(item.product_id, item.product_name, item.unit);
        const isKg = row.baseUnit === 'kg';

        // Match PL metadata row if private label box sale
        const plItem = plMetaItems.find(p => p.pack_size_id === item.pack_size_id) || plMetaItems[idx];

        let itemKg = 0;

        if (plItem && Number(plItem.box_qty || 0) > 0 && Number(plItem.bottles_per_box || 0) > 0) {
          // --- BOX SALE ---
          // boxes x bottles per box x bottle size in liters, then x density
          const boxes = Number(plItem.box_qty);
          const bPerBox = Number(plItem.bottles_per_box);
          const totalBottles = Number(plItem.bottle_qty || (boxes * bPerBox));
          const bottleSizeLiters = Number(item.size_in_base_unit || (totalBottles > 0 && plItem.liters_qty ? plItem.liters_qty / totalBottles : 1.0));
          const totalLiters = Number(plItem.liters_qty || (boxes * bPerBox * bottleSizeLiters));

          itemKg = isKg ? totalLiters : (totalLiters * row.density);
          row.soldBoxKg += itemKg;
          totalBoxSoldKg += itemKg;
        } else if (item.pack_size_id || (item.pack_size_name && !item.pack_size_name.toLowerCase().includes('bulk') && !item.pack_size_name.toLowerCase().includes('loose'))) {
          // --- BOTTLE SALE ---
          // bottles x bottle size in liters, then x density
          const bottles = Number(item.bottle_qty || item.pack_quantity || item.quantity || 0);
          const bottleSizeLiters = Number(item.size_in_base_unit || (bottles > 0 && item.base_quantity ? item.base_quantity / bottles : 1.0));
          const totalLiters = Number(item.liters_qty || item.base_quantity || (bottles * bottleSizeLiters));

          itemKg = isKg ? totalLiters : (totalLiters * row.density);
          row.soldBottleKg += itemKg;
          totalBottleSoldKg += itemKg;
        } else {
          // --- BULK / LOOSE SALE ---
          // liters or kg directly
          const qty = Number(item.base_quantity || item.quantity || 0);
          itemKg = isKg ? qty : (qty * row.density);
          row.soldBulkKg += itemKg;
          totalBulkSoldKg += itemKg;
        }

        row.soldTotalKg += itemKg;
        totalManufacturedSoldKg += itemKg;
      });
    });

    // Subtract Sales Returns
    let totalSalesReturnsKg = 0;
    validReturns.forEach(ret => {
      (ret.items || []).forEach(rItem => {
        const isRawMaterial = rItem.item_type === 'raw_material' || (!rItem.product_id && Boolean(rItem.raw_material_id));
        if (isRawMaterial) return;

        const linkedProd = rItem.product_id ? productMapById.get(rItem.product_id) : productMapByName.get(rItem.product_name.trim().toLowerCase());
        if (!matchesBrandFilter(linkedProd)) return;

        const row = getProductRow(rItem.product_id, rItem.product_name, rItem.unit);
        const isKg = row.baseUnit === 'kg';
        const qtyReturned = Number(rItem.base_quantity || rItem.quantity || 0);
        const returnedKg = isKg ? qtyReturned : (qtyReturned * row.density);

        row.returnedKg += returnedKg;
        totalSalesReturnsKg += returnedKg;
      });
    });

    // Net Sold per product
    Object.values(productStatsMap).forEach(row => {
      row.netSoldKg = Math.max(0, row.soldTotalKg - row.returnedKg);
    });

    const netSoldTotalKg = Math.max(0, totalManufacturedSoldKg - totalSalesReturnsKg);
    const netRemainingKg = totalProducedKg - netSoldTotalKg;
    const soldPercentage = totalProducedKg > 0 ? (netSoldTotalKg / totalProducedKg) * 100 : 0;

    // Current Total Warehouse Stock on Hand (Bulk + Packed, converted to kg)
    const currentWarehouseStockOnHandKg = displayProducts.reduce((acc, p) => {
      const isKg = p.base_unit === 'kg' || p.unit === 'kg';
      const density = getProductDensity(p, p.base_unit || p.unit);
      const bulkKg = Number(p.current_stock || 0) * (isKg ? 1.0 : density);
      const packedKg = (p.pack_sizes || []).reduce((sum, ps) => {
        const qty = Number(ps.packed_stock || 0);
        const size = Number(ps.size_in_base_unit || 1);
        return sum + (qty * size * (isKg ? 1.0 : density));
      }, 0);
      return acc + bulkKg + packedKg;
    }, 0);

    // Sorted products list
    const productRows = Object.values(productStatsMap).filter(row => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return row.productName.toLowerCase().includes(q) || row.category.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => b.producedKg - a.producedKg || b.netSoldKg - a.netSoldKg);

    return {
      totalProducedKg,
      totalBatchesCount,
      totalManufacturedSoldKg: netSoldTotalKg,
      totalBulkSoldKg,
      totalBottleSoldKg,
      totalBoxSoldKg,
      totalSalesReturnsKg,
      totalRawMaterialResaleKg,
      netRemainingKg,
      soldPercentage,
      currentWarehouseStockOnHandKg,
      productRows
    };
  }, [
    productionBatches,
    sales,
    salesReturns,
    rawMaterials,
    displayProducts,
    filterMode,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate,
    brandFilter,
    searchQuery,
    productMapById,
    productMapByName
  ]);

  // ============================================================================
  // MONTH-BY-MONTH TREND DATA & BAR CHART (IN TONS)
  // ============================================================================
  const monthlyTrends = useMemo(() => {
    const monthMap: Record<string, { monthKey: string; producedKg: number; soldKg: number; batchesCount: number }> = {};

    // Populate months from available months list
    availableMonths.forEach(m => {
      monthMap[m] = { monthKey: m, producedKg: 0, soldKg: 0, batchesCount: 0 };
    });

    // Tally production batches
    (productionBatches || []).forEach(b => {
      const m = b.date?.slice(0, 7);
      if (!m || !monthMap[m]) return;
      const linkedProd = b.product_id ? productMapById.get(b.product_id) : productMapByName.get(b.product_name.trim().toLowerCase());
      if (!matchesBrandFilter(linkedProd)) return;

      const isKg = (linkedProd?.base_unit === 'kg' || linkedProd?.unit === 'kg' || b.base_unit === 'kg');
      const density = getProductDensity(linkedProd, b.base_unit);
      const qty = Number(b.quantity_produced || 0);
      const kg = isKg ? qty : (qty * density);

      monthMap[m].producedKg += kg;
      monthMap[m].batchesCount += 1;
    });

    // Tally sales
    (sales || []).forEach(s => {
      if (s.is_archived) return;
      const m = s.date?.slice(0, 7);
      if (!m || !monthMap[m]) return;

      let plData: any[] = [];
      if (s.notes?.includes('<!--PL_DATA:')) {
        const match = s.notes.match(/<!--PL_DATA:(.*?)-->/);
        if (match && match[1]) {
          try { plData = JSON.parse(match[1]).items || []; } catch (e) {}
        }
      }

      (s.items || []).forEach((it, idx) => {
        const isRm = it.item_type === 'raw_material' || (!it.product_id && Boolean(it.raw_material_id)) || rawMaterials.some(r => r.id === it.raw_material_id || r.name.toLowerCase() === it.product_name.toLowerCase());
        if (isRm) return;

        const linkedProd = it.product_id ? productMapById.get(it.product_id) : productMapByName.get(it.product_name.trim().toLowerCase());
        const isPLSale = Boolean(it.is_private_label || s.is_private_label || (linkedProd && linkedProd.is_private_label));
        if (!matchesBrandFilter(linkedProd, isPLSale)) return;

        const isKg = (linkedProd?.base_unit === 'kg' || linkedProd?.unit === 'kg' || it.unit === 'kg');
        const density = getProductDensity(linkedProd, linkedProd?.base_unit || it.unit);

        const plItem = plData.find(p => p.pack_size_id === it.pack_size_id) || plData[idx];
        let kg = 0;

        if (plItem && Number(plItem.box_qty || 0) > 0 && Number(plItem.bottles_per_box || 0) > 0) {
          const bottleSize = Number(it.size_in_base_unit || (plItem.bottle_qty ? plItem.liters_qty / plItem.bottle_qty : 1));
          const liters = Number(plItem.liters_qty || (plItem.box_qty * plItem.bottles_per_box * bottleSize));
          kg = isKg ? liters : (liters * density);
        } else if (it.pack_size_id || (it.pack_size_name && !it.pack_size_name.toLowerCase().includes('bulk') && !it.pack_size_name.toLowerCase().includes('loose'))) {
          const bottles = Number(it.bottle_qty || it.pack_quantity || it.quantity || 0);
          const bottleSize = Number(it.size_in_base_unit || (it.base_quantity && bottles ? it.base_quantity / bottles : 1));
          const liters = Number(it.liters_qty || item_base_qty(it, bottles, bottleSize));
          kg = isKg ? liters : (liters * density);
        } else {
          const qty = Number(it.base_quantity || it.quantity || 0);
          kg = isKg ? qty : (qty * density);
        }

        monthMap[m].soldKg += kg;
      });
    });

    // Helper for safe base qty
    function item_base_qty(it: any, bottles: number, size: number) {
      return it.base_quantity || (bottles * size);
    }

    // Convert to sorted array
    const sorted = Object.values(monthMap)
      .filter(m => m.producedKg > 0 || m.soldKg > 0)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Find maximum tons for scaling bar chart
    const maxTons = Math.max(0.1, ...sorted.map(m => Math.max(m.producedKg / 1000, m.soldKg / 1000)));

    return {
      months: sorted,
      maxTons
    };
  }, [availableMonths, productionBatches, sales, rawMaterials, brandFilter, productMapById, productMapByName]);

  // ============================================================================
  // CSV EXPORT HANDLER
  // ============================================================================
  const handleExportCSV = () => {
    const filterLabel = filterMode === 'month' ? selectedMonth : (filterMode === 'year' ? selectedYear : (filterMode === 'custom' ? `${customStartDate}_to_${customEndDate}` : 'all_time'));
    const filename = `PSC_Production_Volume_Report_${filterLabel}_${brandFilter}`;

    const headers = [
      'Chemical Product',
      'Category',
      'Brand Type',
      'Base Unit',
      'Density (kg/L)',
      'Produced (kg)',
      'Produced (tons)',
      'Sold Bulk (kg)',
      'Sold Bottles (kg)',
      'Sold Boxes (kg)',
      'Total Sold (kg)',
      'Total Sold (tons)',
      'Remaining (kg)',
      'Remaining (tons)',
      'Sold %',
      'Current Stock on Hand (kg)',
      'Current Stock on Hand (tons)'
    ];

    const rows = reportData.productRows.map(row => {
      const remKg = row.producedKg - row.netSoldKg;
      const soldPct = row.producedKg > 0 ? ((row.netSoldKg / row.producedKg) * 100).toFixed(1) + '%' : '0.0%';
      return [
        row.productName,
        row.category,
        row.isPrivateLabel ? 'Private Label' : 'Own Brand',
        row.baseUnit,
        row.density.toFixed(3),
        row.producedKg.toFixed(3),
        (row.producedKg / 1000).toFixed(3),
        row.soldBulkKg.toFixed(3),
        row.soldBottleKg.toFixed(3),
        row.soldBoxKg.toFixed(3),
        row.netSoldKg.toFixed(3),
        (row.netSoldKg / 1000).toFixed(3),
        remKg.toFixed(3),
        (remKg / 1000).toFixed(3),
        soldPct,
        row.currentTotalStockKg.toFixed(3),
        (row.currentTotalStockKg / 1000).toFixed(3)
      ];
    });

    // Add totals row
    rows.push([
      '=== TOTALS ===',
      '-',
      brandFilter.toUpperCase(),
      '-',
      '-',
      reportData.totalProducedKg.toFixed(3),
      (reportData.totalProducedKg / 1000).toFixed(3),
      reportData.totalBulkSoldKg.toFixed(3),
      reportData.totalBottleSoldKg.toFixed(3),
      reportData.totalBoxSoldKg.toFixed(3),
      reportData.totalManufacturedSoldKg.toFixed(3),
      (reportData.totalManufacturedSoldKg / 1000).toFixed(3),
      reportData.netRemainingKg.toFixed(3),
      (reportData.netRemainingKg / 1000).toFixed(3),
      reportData.soldPercentage.toFixed(1) + '%',
      reportData.currentWarehouseStockOnHandKg.toFixed(3),
      (reportData.currentWarehouseStockOnHandKg / 1000).toFixed(3)
    ]);

    // Add Raw Material Resale Line
    rows.push([
      '=== RAW MATERIAL RESALE (SEPARATE) ===',
      'Chemical Resale',
      'Direct Resale',
      'kg',
      '1.000',
      '0.000',
      '0.000',
      reportData.totalRawMaterialResaleKg.toFixed(3),
      '0.000',
      '0.000',
      reportData.totalRawMaterialResaleKg.toFixed(3),
      (reportData.totalRawMaterialResaleKg / 1000).toFixed(3),
      '-',
      '-',
      '-',
      '-',
      '-'
    ]);

    exportToCSV(filename, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Production Volume Report</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                Weight (KG & Tons)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Manufactured weight output vs invoiced sales across chemical products
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
            title="Download report data as CSV file"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-teal-400" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Density Note Callout */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-200 text-xs">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-emerald-300">Conversion Standard: </span>
          Liquid products are converted to kg using the density set on each product (default 1.0 kg/L). Products measured in kg require no conversion. Weight in tons is calculated as <code className="px-1 py-0.5 bg-emerald-900/60 rounded text-emerald-200 font-mono font-bold">1 ton = 1,000 kg</code>.
        </div>
      </div>

      {/* FILTER CONTROLS TOOLBAR */}
      <div className="no-print p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterMode('month')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterMode === 'month' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setFilterMode('year')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterMode === 'year' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Year View
            </button>
            <button
              onClick={() => setFilterMode('custom')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterMode === 'custom' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom Range
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filterMode === 'all' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Brand Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-semibold">Brand Filter:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setBrandFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  brandFilter === 'all' ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Products
              </button>
              <button
                onClick={() => setBrandFilter('own')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  brandFilter === 'own' ? 'bg-teal-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Own Brand
              </button>
              <button
                onClick={() => setBrandFilter('private_label')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  brandFilter === 'private_label' ? 'bg-purple-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Private Label
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Secondary Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
          {filterMode === 'month' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Select Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)} ({m})
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'year' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Select Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y} Calendar Year</option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'custom' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Date Range:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          )}

          <div className="flex-1 min-w-[200px] max-w-xs ml-auto">
            <input
              type="text"
              placeholder="Filter by product name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
        <h1 className="text-2xl font-black text-slate-900">PERFECT SHINE CHEMICALS</h1>
        <p className="text-xs text-slate-600">Production Volume Report in Weight (Kg & Tons)</p>
        <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
          <span>
            Period: {filterMode === 'month' ? formatMonthLabel(selectedMonth) : (filterMode === 'year' ? selectedYear : (filterMode === 'custom' ? `${customStartDate} to ${customEndDate}` : 'All Time'))}
          </span>
          <span>Brand Scope: {brandFilter.toUpperCase()}</span>
          <span>Printed: {new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Produced */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FlaskConical className="w-16 h-16 text-emerald-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Manufactured</span>
            <Badge variant="emerald">{reportData.totalBatchesCount} batches</Badge>
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
            {formatKg(reportData.totalProducedKg)}
          </p>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">In Metric Tons:</span>
            <span className="font-mono font-bold text-emerald-300">{formatTons(reportData.totalProducedKg)}</span>
          </div>
          <p className="text-[10px] text-slate-400 italic">Production batches output only (no packing runs)</p>
        </div>

        {/* Card 2: Total Sold */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2 relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Package className="w-16 h-16 text-cyan-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sold (Invoiced)</span>
            {reportData.totalSalesReturnsKg > 0 && (
              <span className="text-[10px] text-rose-400 font-mono">
                −{formatKg(reportData.totalSalesReturnsKg)} ret
              </span>
            )}
          </div>
          <p className="text-2xl font-black text-cyan-400 font-mono tracking-tight">
            {formatKg(reportData.totalManufacturedSoldKg)}
          </p>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">In Metric Tons:</span>
            <span className="font-mono font-bold text-cyan-300">{formatTons(reportData.totalManufacturedSoldKg)}</span>
          </div>
          <p className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Bulk: {Number(reportData.totalBulkSoldKg).toFixed(1)}kg</span>
            <span>Btls: {Number(reportData.totalBottleSoldKg).toFixed(1)}kg</span>
            <span>Boxes: {Number(reportData.totalBoxSoldKg).toFixed(1)}kg</span>
          </p>
        </div>

        {/* Card 3: Remaining */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2 relative overflow-hidden group hover:border-teal-500/40 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers className="w-16 h-16 text-teal-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Period Net Remaining</span>
            <Badge variant={reportData.netRemainingKg >= 0 ? 'emerald' : 'rose'}>
              {reportData.netRemainingKg >= 0 ? 'Net Surplus' : 'Deficit / Drawn'}
            </Badge>
          </div>
          <p className={`text-2xl font-black font-mono tracking-tight ${reportData.netRemainingKg >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
            {formatKg(reportData.netRemainingKg)}
          </p>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">In Metric Tons:</span>
            <span className={`font-mono font-bold ${reportData.netRemainingKg >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
              {formatTons(reportData.netRemainingKg)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Produced minus invoiced sold in this period</p>
        </div>

        {/* Card 4: Sold % of Produced */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-2 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-16 h-16 text-amber-400" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sold % of Produced</span>
            <span className="text-xs font-mono font-bold text-amber-300">{reportData.soldPercentage.toFixed(1)}%</span>
          </div>
          <p className="text-2xl font-black text-amber-400 font-mono tracking-tight">
            {reportData.soldPercentage.toFixed(1)}%
          </p>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-1">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                reportData.soldPercentage > 100 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, reportData.soldPercentage)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
            <span>Turnover ratio</span>
            <span>{reportData.soldPercentage > 100 ? 'Sold > Output (From opening inventory)' : 'Within period output'}</span>
          </p>
        </div>
      </div>

      {/* RAW MATERIAL RESALE SEPARATE LINE */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white text-sm">Raw Material Direct Resale (Non-Manufactured)</span>
            <p className="text-slate-400 text-[11px]">
              Direct raw material resale (like LABSA, SLES, Caustic) is kept strictly separated so it does not mix into manufactured output totals.
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-slate-400 text-[11px] block">Resale Volume:</span>
          <span className="text-sm font-mono font-black text-indigo-300">
            {formatKg(reportData.totalRawMaterialResaleKg)}
          </span>
          <span className="text-slate-400 text-xs ml-1 font-mono">
            ({formatTons(reportData.totalRawMaterialResaleKg)})
          </span>
        </div>
      </div>

      {/* CONSISTENCY CHECK BOX */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/90 border border-amber-500/30 p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Inventory Consistency Check: Period Remaining vs Current Warehouse Stock on Hand
            </h3>
            <p className="text-xs text-slate-400">
              Audit comparison between theoretical manufactured surplus and physical stock on hand
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[11px] block">1. Period Theoretical Remaining (Output − Sold):</span>
            <p className={`text-base font-bold font-mono ${reportData.netRemainingKg >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
              {formatKg(reportData.netRemainingKg)} <span className="text-xs font-normal text-slate-400">({formatTons(reportData.netRemainingKg)})</span>
            </p>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[11px] block">2. Current Physical Stock on Hand (Bulk + Packed + Boxed):</span>
            <p className="text-base font-bold font-mono text-emerald-400">
              {formatKg(reportData.currentWarehouseStockOnHandKg)} <span className="text-xs font-normal text-slate-400">({formatTons(reportData.currentWarehouseStockOnHandKg)})</span>
            </p>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 sm:col-span-2 lg:col-span-1">
            <span className="text-slate-400 text-[11px] block">Variance Explanation:</span>
            <p className="text-[11px] text-slate-300 leading-snug">
              The period remaining is period-specific (batches produced minus invoices). The current stock on hand differs due to opening stock from earlier months, stock adjustments, wastage, or edited batches.
            </p>
          </div>
        </div>
      </div>

      {/* PER-PRODUCT TABLE */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <span>Per-Product Production & Sales Volume Breakdown</span>
            </h3>
            <p className="text-xs text-slate-400">
              Manufactured weight vs sales weight per product (sorted by output volume)
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {reportData.productRows.length} products listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Chemical Product</th>
                <th className="py-3 px-3">Brand / Scope</th>
                <th className="py-3 px-3 text-center">Density (kg/L)</th>
                <th className="py-3 px-3 text-right">Produced (kg)</th>
                <th className="py-3 px-3 text-right">Produced (Tons)</th>
                <th className="py-3 px-3 text-right">Sold (kg)</th>
                <th className="py-3 px-3 text-right">Sold (Tons)</th>
                <th className="py-3 px-3 text-right">Remaining (kg)</th>
                <th className="py-3 px-3 text-right">Remaining (Tons)</th>
                <th className="py-3 px-3 text-center">Sold %</th>
                <th className="py-3 px-3 text-right">Current Stock (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {reportData.productRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-500 font-sans">
                    No products matched your filter selection.
                  </td>
                </tr>
              ) : (
                reportData.productRows.map((row, idx) => {
                  const remKg = row.producedKg - row.netSoldKg;
                  const soldPct = row.producedKg > 0 ? ((row.netSoldKg / row.producedKg) * 100).toFixed(1) : (row.netSoldKg > 0 ? '100+' : '0.0');

                  return (
                    <tr key={row.productId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-3 font-sans font-bold text-white">
                        <span>{row.productName}</span>
                        <span className="block text-[10px] text-slate-400 font-normal">{row.category}</span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <Badge variant={row.isPrivateLabel ? 'purple' : 'blue'}>
                          {row.isPrivateLabel ? 'Private Label' : 'Own Brand'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-300">
                        {row.baseUnit === 'kg' ? (
                          <span className="text-slate-400 font-sans text-[11px]">Kg Base</span>
                        ) : (
                          <span className="text-emerald-400 font-bold">{row.density.toFixed(3)}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400">
                        {Number(row.producedKg).toFixed(3)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-300/80">
                        {(row.producedKg / 1000).toFixed(3)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-cyan-400" title={`Bulk: ${row.soldBulkKg.toFixed(2)}kg | Btls: ${row.soldBottleKg.toFixed(2)}kg | Boxes: ${row.soldBoxKg.toFixed(2)}kg`}>
                        {Number(row.netSoldKg).toFixed(3)}
                      </td>
                      <td className="py-3 px-3 text-right text-cyan-300/80">
                        {(row.netSoldKg / 1000).toFixed(3)}
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${remKg >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                        {remKg.toFixed(3)}
                      </td>
                      <td className={`py-3 px-3 text-right ${remKg >= 0 ? 'text-teal-300/80' : 'text-rose-300/80'}`}>
                        {(remKg / 1000).toFixed(3)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          parseFloat(soldPct) >= 100 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300'
                        }`}>
                          {soldPct}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-200">
                        {Number(row.currentTotalStockKg).toFixed(3)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot>
              <tr className="border-t-2 border-slate-700 bg-slate-950/80 font-mono font-bold text-xs text-white">
                <td colSpan={4} className="py-3 px-3 font-sans uppercase tracking-wider text-slate-300">
                  Total Across Filtered Products:
                </td>
                <td className="py-3 px-3 text-right text-emerald-400">
                  {reportData.totalProducedKg.toFixed(3)} kg
                </td>
                <td className="py-3 px-3 text-right text-emerald-300">
                  {(reportData.totalProducedKg / 1000).toFixed(3)} t
                </td>
                <td className="py-3 px-3 text-right text-cyan-400">
                  {reportData.totalManufacturedSoldKg.toFixed(3)} kg
                </td>
                <td className="py-3 px-3 text-right text-cyan-300">
                  {(reportData.totalManufacturedSoldKg / 1000).toFixed(3)} t
                </td>
                <td className={`py-3 px-3 text-right ${reportData.netRemainingKg >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                  {reportData.netRemainingKg.toFixed(3)} kg
                </td>
                <td className={`py-3 px-3 text-right ${reportData.netRemainingKg >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
                  {(reportData.netRemainingKg / 1000).toFixed(3)} t
                </td>
                <td className="py-3 px-3 text-center text-amber-400">
                  {reportData.soldPercentage.toFixed(1)}%
                </td>
                <td className="py-3 px-3 text-right text-slate-200">
                  {reportData.currentWarehouseStockOnHandKg.toFixed(3)} kg
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MONTH-BY-MONTH SUMMARY TABLE & BAR CHART (IN TONS) */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Month-by-Month Production vs Sales Trend (Metric Tons)</span>
          </h3>
          <p className="text-xs text-slate-400">
            Historical comparison of chemical manufactured volume vs sales volume in metric tons (1 ton = 1,000 kg)
          </p>
        </div>

        {/* Visual Bar Chart */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                <span className="text-white font-medium">Manufactured Output (Tons)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-cyan-500 inline-block" />
                <span className="text-white font-medium">Sales Invoiced (Tons)</span>
              </span>
            </div>
            <span className="font-mono text-[11px]">Chart Scale Peak: {monthlyTrends.maxTons.toFixed(3)} Tons</span>
          </div>

          {monthlyTrends.months.length === 0 ? (
            <p className="py-8 text-center text-slate-500 text-xs">No historical volume data available.</p>
          ) : (
            <div className="space-y-4 pt-2">
              {monthlyTrends.months.map(item => {
                const prodTons = item.producedKg / 1000;
                const soldTons = item.soldKg / 1000;
                const prodPct = Math.min(100, (prodTons / monthlyTrends.maxTons) * 100);
                const soldPct = Math.min(100, (soldTons / monthlyTrends.maxTons) * 100);

                return (
                  <div key={item.monthKey} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{formatMonthLabel(item.monthKey)}</span>
                      <div className="flex items-center gap-4 font-mono text-[11px]">
                        <span className="text-emerald-400">Produced: {prodTons.toFixed(3)} t ({item.producedKg.toFixed(1)} kg)</span>
                        <span className="text-cyan-400">Sold: {soldTons.toFixed(3)} t ({item.soldKg.toFixed(1)} kg)</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {/* Produced bar */}
                      <div className="w-full bg-slate-900 rounded-lg h-3 overflow-hidden flex items-center">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-lg transition-all duration-500"
                          style={{ width: `${Math.max(2, prodPct)}%` }}
                        />
                      </div>
                      {/* Sold bar */}
                      <div className="w-full bg-slate-900 rounded-lg h-3 overflow-hidden flex items-center">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-lg transition-all duration-500"
                          style={{ width: `${Math.max(2, soldPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Calendar Month</th>
                <th className="py-3 px-3 text-center">Batches Run</th>
                <th className="py-3 px-3 text-right">Produced (Tons)</th>
                <th className="py-3 px-3 text-right">Produced (Kg)</th>
                <th className="py-3 px-3 text-right">Sold (Tons)</th>
                <th className="py-3 px-3 text-right">Sold (Kg)</th>
                <th className="py-3 px-3 text-right">Net Variance (Tons)</th>
                <th className="py-3 px-3 text-center">Sold %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {monthlyTrends.months.map(m => {
                const prodTons = m.producedKg / 1000;
                const soldTons = m.soldKg / 1000;
                const remTons = prodTons - soldTons;
                const soldPct = prodTons > 0 ? ((soldTons / prodTons) * 100).toFixed(1) : (soldTons > 0 ? '100+' : '0.0');

                return (
                  <tr key={m.monthKey} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-sans font-bold text-white">
                      {formatMonthLabel(m.monthKey)}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-300">
                      {m.batchesCount}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {prodTons.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-300/80">
                      {m.producedKg.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-cyan-400">
                      {soldTons.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-right text-cyan-300/80">
                      {m.soldKg.toFixed(3)}
                    </td>
                    <td className={`py-3 px-3 text-right font-bold ${remTons >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                      {remTons.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        parseFloat(soldPct) >= 100 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'
                      }`}>
                        {soldPct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
