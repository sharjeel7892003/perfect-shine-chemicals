import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { Partner } from '../../types';
import { Modal } from '../common/Modal';

interface PartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (partnerData: Omit<Partner, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  initialPartner?: Partner | null;
}

export const PartnerModal: React.FC<PartnerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPartner,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [initialCapital, setInitialCapital] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialPartner) {
      setName(initialPartner.name);
      setPhone(initialPartner.phone || '');
      setEmail(initialPartner.email || '');
      setInitialCapital(Number(initialPartner.initial_capital || 0));
      setNotes(initialPartner.notes || '');
      setIsActive(initialPartner.is_active !== false);
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setInitialCapital(0);
      setNotes('');
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [initialPartner, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Partner name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        initial_capital: Number(initialCapital || 0),
        is_active: isActive,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save partner.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialPartner ? `Edit Partner: ${initialPartner.name}` : 'Add Company Partner'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-slate-400 font-medium mb-1">
            Partner Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Sharjeel, Aqeel"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 0300-1234567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Email Address</label>
            <input
              type="email"
              placeholder="e.g. partner@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">
            Initial Contributed Capital (PKR)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={initialCapital === 0 ? '' : initialCapital}
            onChange={e => setInitialCapital(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-indigo-300 font-mono font-bold focus:border-emerald-500 focus:outline-none"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Initial equity balance at company founding. Future contributions will be tracked automatically.
          </p>
        </div>

        <div>
          <label className="block text-slate-400 font-medium mb-1">Notes</label>
          <input
            type="text"
            placeholder="e.g. Founding managing partner"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="partner_active"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
          />
          <label htmlFor="partner_active" className="text-slate-300 font-medium cursor-pointer">
            Partner is actively in business
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5px]" />
            <span>{isSubmitting ? 'Saving...' : initialPartner ? 'Update Partner' : 'Save Partner'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
