import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ProductionBatch } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, ShieldAlert, Trash2, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatQuantity } from '../../utils/formatters';

interface ProductionBatchDeleteModalProps {
  batch: ProductionBatch | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProductionBatchDeleteModal: React.FC<ProductionBatchDeleteModalProps> = ({
  batch,
  onClose,
  onSuccess
}) => {
  const { products, rawMaterials, deleteProductionBatch } = useApp();
  const { currentUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!batch) return null;

  const targetProduct = products.find(p => p.id === batch.product_id);
  const currentProdStock = targetProduct ? Number(targetProduct.current_stock) : 0;
  const batchQtyProduced = Number(batch.quantity_produced);
  const isBlocked = currentProdStock < batchQtyProduced;
  const shortage = isBlocked ? Number((batchQtyProduced - currentProdStock).toFixed(4)) : 0;
  const remainingBulkStock = !isBlocked ? Number((currentProdStock - batchQtyProduced).toFixed(4)) : 0;

  const handleDelete = async () => {
    if (isBlocked || !currentUser) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await deleteProductionBatch(batch.id, currentUser);
      if (res.success) {
        alert(res.message);
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete and reverse production batch.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={!!batch}
      onClose={onClose}
      title={`Delete & Reverse Batch: ${batch.batch_number}`}
      subtitle="Strict Atomic Inventory Reversal & Safety Verification"
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Error message if action failed */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Deletion Error</span>
              <p className="text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Safety Check: BLOCKED case */}
        {isBlocked ? (
          <div className="p-4 rounded-xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-200 space-y-3">
            <div className="flex items-center gap-2 font-bold text-rose-400 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
              <span>Deletion Blocked: Finished Goods Stock Already Consumed</span>
            </div>

            <p className="text-xs leading-relaxed text-slate-200">
              Cannot delete or reverse batch <strong className="font-mono text-white">{batch.batch_number}</strong> because 
              its manufactured output has already been consumed (e.g. bottled in a packing run or dispatched to customers on sales invoices).
            </p>

            <div className="bg-slate-900/90 rounded-xl p-3 border border-rose-500/30 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between items-center text-slate-300">
                <span>Product Name:</span>
                <span className="text-white font-bold">{batch.product_name}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Batch Output Produced:</span>
                <span className="text-amber-400 font-bold">{formatQuantity(batchQtyProduced)} {batch.base_unit}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Current Warehouse Bulk Stock:</span>
                <span className="text-rose-400 font-bold">{formatQuantity(currentProdStock)} {batch.base_unit}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-rose-300 font-bold">
                <span>Consumed Shortage (Missing):</span>
                <span>{formatQuantity(shortage)} {batch.base_unit}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Allowing deletion would drive product bulk inventory negative. To reverse this batch, 
              please first delete or reverse the packaging runs or sales invoices that used this stock.
            </p>
          </div>
        ) : (
          /* Confirmation details: ALLOWED case */
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-300 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Single Atomic Inventory Reversal</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Deleting this batch will permanently remove batch record <strong className="font-mono text-white">{batch.batch_number}</strong>, 
                restore all consumed raw materials to warehouse stock, deduct the bulk product output, 
                and log a permanent entry in the deletion audit trail.
              </p>
            </div>

            {/* Finished Bulk Goods Deduction Preview */}
            <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
              <div className="text-[11px] uppercase tracking-wider font-bold text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Bulk Finished Stock Deduction</span>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-lg text-center font-mono text-[11px]">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Current Stock</div>
                  <div className="font-bold text-slate-200 mt-0.5">{formatQuantity(currentProdStock)} {batch.base_unit}</div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-400 uppercase">Deduction</div>
                  <div className="font-bold text-rose-400 mt-0.5">-{formatQuantity(batchQtyProduced)} {batch.base_unit}</div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-400 uppercase">After Reversal</div>
                  <div className="font-bold text-emerald-400 mt-0.5">{formatQuantity(remainingBulkStock)} {batch.base_unit}</div>
                </div>
              </div>
            </div>

            {/* Raw Materials Restoration Preview */}
            <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <div className="uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Raw Materials Added Back to Inventory ({batch.raw_materials_consumed?.length || 0})</span>
                </div>
                <span className="text-slate-400 text-[10px]">Type: production_reversal</span>
              </div>

              {(!batch.raw_materials_consumed || batch.raw_materials_consumed.length === 0) ? (
                <p className="text-slate-500 italic text-center py-2">No raw material line items recorded for this batch.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800/80 divide-y divide-slate-800/60">
                  {batch.raw_materials_consumed.map((item, idx) => {
                    const rm = rawMaterials.find(m => m.id === item.raw_material_id);
                    const currentRmStock = rm ? Number(rm.current_stock) : 0;
                    const addBack = Number(item.quantity_consumed);
                    const newRmStock = Number((currentRmStock + addBack).toFixed(4));

                    return (
                      <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-900/50 text-[11px]">
                        <div>
                          <span className="font-bold text-white">{item.raw_material_name}</span>
                          <span className="ml-2 font-mono text-emerald-400 font-bold">
                            +{formatQuantity(addBack)} {item.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                          <span>{formatQuantity(currentRmStock)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="text-emerald-400 font-bold">{formatQuantity(newRmStock)} {item.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {isBlocked ? 'Close' : 'Cancel'}
          </button>

          {!isBlocked && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/20 transition-all flex items-center gap-1.5 disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reversing & Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Deletion & Reverse Batch</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
