import React, { useState } from 'react';
import { Product, PackSize } from '../../types';
import { formatPKR } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Plus, Trash2, CheckCircle2, Box, Info, Sparkles } from 'lucide-react';

interface PackSizesModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSave: (productId: string, packSizes: PackSize[]) => void;
}

export const PackSizesModal: React.FC<PackSizesModalProps> = ({
  product,
  isOpen,
  onClose,
  onSave,
}) => {
  const baseUnit = product.base_unit || product.unit || 'liter';
  const initialPackSizes = product.pack_sizes && product.pack_sizes.length > 0 
    ? product.pack_sizes 
    : [
        {
          id: `pk-${Date.now()}-1`,
          product_id: product.id,
          name: 'Standard 1 ' + (baseUnit === 'kg' ? 'Kg' : 'Liter'),
          size_in_base_unit: 1.0,
          unit_label: baseUnit,
          selling_price: product.selling_price,
          is_default: true,
        }
      ];

  const [packSizes, setPackSizes] = useState<PackSize[]>(initialPackSizes.map(p => ({ ...p })));

  const handleAddPackSize = () => {
    const newPack: PackSize = {
      id: `pk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      product_id: product.id,
      name: '5L Commercial Can',
      size_in_base_unit: 5.0,
      unit_label: 'can',
      selling_price: product.selling_price * 5,
      is_default: false,
    };
    setPackSizes(prev => [...prev, newPack]);
  };

  const handleRemovePackSize = (index: number) => {
    if (packSizes.length <= 1) {
      alert('A product must have at least one packaging or bulk sales reference.');
      return;
    }
    setPackSizes(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleChangeField = (index: number, field: keyof PackSize, value: any) => {
    setPackSizes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSetDefault = (index: number) => {
    setPackSizes(prev => prev.map((p, idx) => ({
      ...p,
      is_default: idx === index,
    })));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (packSizes.length === 0) {
      alert('Please add at least one packaging size');
      return;
    }
    onSave(product.id, packSizes);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Packaging & Pack Sizes: ${product.name}`}
      subtitle={`Configure sales packaging variants. All stock is tracked in single base unit (${baseUnit}).`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Banner */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
          <Box className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white">
              Single Stock Source: <span className="font-mono text-emerald-400">{product.current_stock} {baseUnit} in warehouse</span>
            </p>
            <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
              Pack sizes serve as conversion and pricing references. When a customer orders 20 bottles of 500ml (0.5L), 10 Liters will be deducted directly from this single {product.current_stock} {baseUnit} inventory.
            </p>
          </div>
        </div>

        {/* List of Pack Sizes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-400 uppercase">
              Defined Pack Sizes for Sale
            </label>
            <button
              type="button"
              onClick={handleAddPackSize}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Pack Size
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {packSizes.map((pack, idx) => {
              const bottlesEquivalent = pack.size_in_base_unit > 0 
                ? Math.floor(product.current_stock / pack.size_in_base_unit) 
                : 0;

              return (
                <div
                  key={pack.id || idx}
                  className="p-3 bg-slate-800/70 rounded-xl border border-slate-700/80 space-y-2"
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <label className="text-[10px] text-slate-400 uppercase block mb-0.5">Pack Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 500ml Bottle"
                        value={pack.name}
                        onChange={(e) => handleChangeField(idx, 'name', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 uppercase block mb-0.5">Size in {baseUnit}</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={pack.size_in_base_unit}
                          onChange={(e) => handleChangeField(idx, 'size_in_base_unit', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono"
                        />
                        <span className="text-slate-400 text-[11px] font-mono">{baseUnit}</span>
                      </div>
                    </div>

                    <div className="col-span-3">
                      <label className="text-[10px] text-slate-400 uppercase block mb-0.5">Selling Price (PKR)</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={pack.selling_price}
                        onChange={(e) => handleChangeField(idx, 'selling_price', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono font-bold text-emerald-400"
                      />
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1.5 pt-4">
                      <button
                        type="button"
                        onClick={() => handleSetDefault(idx)}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                          pack.is_default
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                        title="Default in POS"
                      >
                        {pack.is_default ? 'Default' : 'Set Def'}
                      </button>

                      {packSizes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePackSize(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-700 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stock Conversion Live Indicator */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
                    <span>
                      Packaging Unit Label: <span className="font-mono text-slate-300 capitalize">{pack.unit_label}</span>
                    </span>
                    <span>
                      Est. Available: <strong className="text-white font-mono">≈ {bottlesEquivalent} {pack.name}s</strong> can be packed
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-colors"
          >
            Save Packaging Setup
          </button>
        </div>
      </form>
    </Modal>
  );
};
