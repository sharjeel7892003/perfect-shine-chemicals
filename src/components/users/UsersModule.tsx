import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  UserCheck, 
  Phone, 
  Mail, 
  Lock, 
  CheckCircle, 
  XCircle,
  Key,
  Edit3,
  Trash2,
  Table,
  History,
  FileText,
  UserX,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Eye,
  Check,
  X,
  Archive,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { UserRole, Profile } from '../../types';
import { formatDateTime, formatDate, formatPKR } from '../../utils/formatters';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

export const UsersModule: React.FC = () => {
  const { allUsers, currentUser, addUser, updateUser, updateUserRole, toggleUserStatus, deleteUser, isOwner } = useAuth();
  const { deletionLogs, sales, productionBatches, stockMovements, rawMaterialMovements } = useApp();

  const [activeTab, setActiveTab] = useState<'staff' | 'matrix' | 'audit_log'>('staff');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<Profile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkUserHasHistory = (userName: string): boolean => {
    const hasSales = sales.some(s => s.salesperson_name === userName);
    const hasBatches = productionBatches.some(b => b.supervisor_name === userName);
    const hasAudit = deletionLogs.some(d => d.performed_by === userName);
    const hasStock = stockMovements.some(sm => sm.created_by_name === userName);
    const hasRawStock = rawMaterialMovements.some(rmm => rmm.created_by_name === userName);
    return hasSales || hasBatches || hasAudit || hasStock || hasRawStock;
  };

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'sales_staff' as UserRole,
    phone: '',
    is_active: true,
  });

  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      role: 'sales_staff',
      phone: '',
      is_active: true,
    });
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (user: Profile) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      is_active: user.is_active,
    });
    setErrorMessage(null);
    setIsEditModalOpen(true);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await addUser(formData);
      setIsAddModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save staff member');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await updateUser(selectedUser.id, formData);
      setIsEditModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update staff member');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'owner': return 'emerald';
      case 'sales_staff': return 'blue';
      case 'accounts_staff': return 'amber';
      default: return 'slate';
    }
  };

  const formatRoleName = (role: UserRole) => {
    switch (role) {
      case 'owner': return 'Owner (Admin)';
      case 'sales_staff': return 'Sales Staff';
      case 'accounts_staff': return 'Accounts Staff';
      default: return 'General Staff';
    }
  };

  // Permission Matrix Data
  const modules = [
    { name: 'POS & Billing (Sales)', owner: 'Full (View/Create/Delete/Reverse)', accounts: 'View Only', sales: 'Create / Billing Only', general: 'No Access' },
    { name: 'Finished Inventory Stock', owner: 'Full (View/Create/Edit/Archive)', accounts: 'View & Stock Adjust', sales: 'View Stock Rates', general: 'View & Stock Adjust' },
    { name: 'Chemical Raw Materials', owner: 'Full (View/Create/Edit/Archive)', accounts: 'View & Stock Adjust', sales: 'View Only', general: 'View & Stock Adjust' },
    { name: 'Formulations / Recipes (BOM)', owner: 'Full (Create/Edit/Archive)', accounts: 'View Only', sales: 'No Access', general: 'View Only' },
    { name: 'Production Batching', owner: 'Full (Record/Delete/Audit)', accounts: 'Record Batch Output', sales: 'No Access', general: 'Record Batch Output' },
    { name: 'Supplier Purchases (PO)', owner: 'Full (Create/Delete/Reverse)', accounts: 'Create & Manage POs', sales: 'No Access', general: 'No Access' },
    { name: 'Customers & Ledgers', owner: 'Full (Manage/Archive/Payments)', accounts: 'Manage & Payments', sales: 'Add & View Balances', general: 'No Access' },
    { name: 'Suppliers & Accounts Payable', owner: 'Full (Manage/Archive/Payments)', accounts: 'Manage & Payments', sales: 'No Access', general: 'No Access' },
    { name: 'Financial Statements & Reports', owner: 'Full (Profit & Margins)', accounts: 'Full (Ledgers/Taxes)', sales: 'No Access', general: 'No Access' },
    { name: 'Staff & RBAC Security', owner: 'Full (Add/Edit/Deactivate/Audit)', accounts: 'No Access', sales: 'No Access', general: 'No Access' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Staff & Role-Based Access Control (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage factory user credentials, permission matrices & review system-wide deletion audit trails
          </p>
        </div>

        {isOwner && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Add Staff Member</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'staff' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Staff Directory ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'matrix' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Permission Matrix
          </button>
          <button
            onClick={() => setActiveTab('audit_log')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'audit_log' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Deletion & Reversal Audit Trail ({deletionLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'staff' && (
        /* ================= TAB 1: STAFF DIRECTORY ================= */
        <div className="space-y-6">
          {/* Role Permission Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <Badge variant="emerald">Owner (Admin)</Badge>
              <p className="text-xs font-semibold text-white mt-2">Full Factory Control</p>
              <p className="text-[11px] text-slate-400 mt-1">All modules, recipes, stock adjustments, role changes & deletion reversals.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <Badge variant="blue">Sales Staff</Badge>
              <p className="text-xs font-semibold text-white mt-2">Billing & Counter Dispatch</p>
              <p className="text-[11px] text-slate-400 mt-1">Create sales invoices, print receipts, select packaging & view stock.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <Badge variant="amber">Accounts Staff</Badge>
              <p className="text-xs font-semibold text-white mt-2">Purchases & Ledgers</p>
              <p className="text-[11px] text-slate-400 mt-1">Supplier purchases, payments cashbook, financial statements & reports.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <Badge variant="slate">General Staff</Badge>
              <p className="text-xs font-semibold text-white mt-2">Plant & Stock Supervision</p>
              <p className="text-[11px] text-slate-400 mt-1">Record chemical production batches and view recipe formulations.</p>
            </div>
          </div>

          {/* Staff Table */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Registered Factory Users & Shift Logins</h3>
              <span className="text-xs text-slate-400">{allUsers.length} Staff Accounts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Staff Name</th>
                    <th className="py-3 px-3">Email / Username</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Assigned Role</th>
                    <th className="py-3 px-3 text-center">Account Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allUsers.map((user) => {
                    const isDeactivated = user.is_deactivated || !user.is_active;

                    return (
                      <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className={`font-bold text-sm ${isDeactivated ? 'text-slate-500 line-through' : 'text-white'}`}>
                                {user.name}
                              </p>
                              {user.id === currentUser.id && (
                                <span className="text-[10px] text-emerald-400 font-semibold">(Current Active Shift)</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">{user.email}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{user.phone || '-'}</td>
                        <td className="py-3 px-3">
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {formatRoleName(user.role)}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isDeactivated ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                              <XCircle className="w-3.5 h-3.5" /> Deactivated
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle className="w-3.5 h-3.5" /> Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOwner && (
                              <>
                                <button
                                  onClick={() => openEditModal(user)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                  title="Edit Staff Member"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {user.id !== currentUser.id && (
                                  !isDeactivated ? (
                                    checkUserHasHistory(user.name) ? (
                                      <button
                                        onClick={() => setDeleteConfirmUser(user)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
                                        title="Archive & deactivate staff account (has transaction history)"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        <span>Archive</span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setDeleteConfirmUser(user)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
                                        title="Delete staff account permanently (0 transaction history)"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete</span>
                                      </button>
                                    )
                                  ) : (
                                    <button
                                      onClick={() => toggleUserStatus(user.id)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors"
                                      title="Reactivate Account"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                      <span>Reactivate</span>
                                    </button>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        /* ================= TAB 2: PERMISSION MATRIX ================= */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-400" />
                <span>Role-Based Access Control (RBAC) Permission Matrix</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact security policies enforced across factory modules and operations
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Factory Module</th>
                  <th className="py-3 px-3 text-emerald-400 font-bold">Owner (Admin)</th>
                  <th className="py-3 px-3 text-amber-400 font-bold">Accounts Staff</th>
                  <th className="py-3 px-3 text-blue-400 font-bold">Sales Staff</th>
                  <th className="py-3 px-3 text-slate-300 font-bold">General Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {modules.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-white">{m.name}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono text-[11px]">
                        {m.owner}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[11px]">
                        {m.accounts}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono text-[11px]">
                        {m.sales}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {m.general}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit_log' && (
        /* ================= TAB 3: DELETION AUDIT TRAIL ================= */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <span>System Deletion, Archive & Reversal Audit Trail</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete forensic history of who deleted what, timestamps & automated inventory/balance reversals
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">{deletionLogs.length} Total Audit Logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Entity Type</th>
                  <th className="py-3 px-3">Item Title / Ref</th>
                  <th className="py-3 px-3">Action Type</th>
                  <th className="py-3 px-3">Impact & Reversal Summary</th>
                  <th className="py-3 px-3">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {deletionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No deletion or archive events recorded in the audit trail yet.
                    </td>
                  </tr>
                ) : (
                  deletionLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {formatDateTime(log.date)}
                      </td>
                      <td className="py-3 px-3 capitalize font-semibold text-white">
                        {log.entity_type.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                        {log.entity_title}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            log.action_type === 'reversed_and_deleted'
                              ? 'rose'
                              : log.action_type === 'archived'
                              ? 'amber'
                              : 'slate'
                          }
                        >
                          {log.action_type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-md">
                        <p className="line-clamp-2">{log.impact_summary}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-medium">
                        {log.performed_by} ({log.performed_by_role.replace('_', ' ')})
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Factory Staff"
        subtitle="Create user login credentials and assign role permissions"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Asad Qureshi"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email / Login ID</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="staff@perfectshine.pk"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0321-1234567"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Assigned Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="sales_staff">Sales Staff (Billing & Invoicing)</option>
              <option value="accounts_staff">Accounts Staff (Purchases & Ledgers)</option>
              <option value="general_staff">General Staff (Stock & Production)</option>
              <option value="owner">Owner (Admin - Full Access)</option>
            </select>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Cloud...</span>
                </>
              ) : (
                <span>Add Staff Member</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      {selectedUser && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => !isSaving && setIsEditModalOpen(false)}
          title={`Edit Staff Details: ${selectedUser.name}`}
          subtitle="Update contact info or reassign factory authorization role"
        >
          <form onSubmit={handleSaveEditUser} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email / Login ID</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Assigned Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                disabled={selectedUser.id === currentUser.id}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value="sales_staff">Sales Staff (Billing & Invoicing)</option>
                <option value="accounts_staff">Accounts Staff (Purchases & Ledgers)</option>
                <option value="general_staff">General Staff (Stock & Production)</option>
                <option value="owner">Owner (Admin - Full Access)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Cloud...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete / Deactivate Staff User Confirmation Modal */}
      {deleteConfirmUser && (() => {
        const hasHistory = checkUserHasHistory(deleteConfirmUser.name);
        return (
          <Modal
            isOpen={!!deleteConfirmUser}
            onClose={() => setDeleteConfirmUser(null)}
            title={hasHistory ? `Archive / Deactivate Staff: ${deleteConfirmUser.name}` : `Delete Staff Account: ${deleteConfirmUser.name}`}
            subtitle={hasHistory ? "Preserves sales, supervisor logs & audit trails under their name" : "Permanent removal of unused staff login"}
          >
            <div className="space-y-4 text-xs">
              {hasHistory ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-400">
                    <Archive className="w-4 h-4 shrink-0" />
                    <span>Transaction & Audit History Detected (Soft Archive):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This staff member has recorded sales invoices, supervised production batches, or logged stock movements. To protect the factory's accountability ledger and shift audit trails, this user <strong>cannot be permanently deleted</strong>.
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px] mt-1.5">
                    Deactivating (archiving) will immediately <strong>block login access</strong> and prevent switching to this account, while all past actions recorded under <strong>"{deleteConfirmUser.name}"</strong> will remain permanently preserved in the factory audit trail.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Zero Activity Detected (Permanent Delete):</span>
                  </p>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    This staff account has <strong>0 logged transactions or audit entries</strong>. It will be <strong>permanently deleted</strong> from the factory user directory.
                  </p>
                </div>
              )}

              <p className="text-slate-300">
                Are you sure you want to {hasHistory ? 'deactivate (archive)' : 'permanently delete'} <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})?
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (hasHistory) {
                        await toggleUserStatus(deleteConfirmUser.id);
                        alert(`Account "${deleteConfirmUser.name}" was deactivated (archived). Login access revoked.`);
                      } else {
                        await deleteUser(deleteConfirmUser.id);
                        alert(`Account "${deleteConfirmUser.name}" was permanently deleted.`);
                      }
                      setDeleteConfirmUser(null);
                    } catch (err: any) {
                      alert(`Error updating staff account: ${err.message}`);
                    }
                  }}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-colors ${
                    hasHistory ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {hasHistory ? 'Confirm & Deactivate Account' : 'Confirm Permanent Deletion'}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
