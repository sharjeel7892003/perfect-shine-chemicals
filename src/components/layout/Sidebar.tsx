import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Truck, 
  Users, 
  Building2, 
  CreditCard, 
  BarChart3, 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle,
  RotateCcw,
  FlaskConical,
  Layers,
  Factory
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Badge } from '../common/Badge';

export type ActiveTab = 
  | 'dashboard' 
  | 'sales' 
  | 'inventory' 
  | 'raw_materials'
  | 'formulations'
  | 'production'
  | 'purchases' 
  | 'customers' 
  | 'suppliers' 
  | 'payments' 
  | 'reports' 
  | 'users';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { 
    currentUser, 
    isOwner, 
    canViewReports, 
    canManagePurchases, 
    canManageUsers,
    canManageFormulations,
    canRecordProduction,
    canManageRawMaterials
  } = useAuth();
  
  const { lowStockProducts, lowStockRawMaterials, resetToDefaultData } = useApp();

  const totalLowAlerts = lowStockProducts.length + lowStockRawMaterials.length;

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard, visible: true },
    { id: 'sales' as ActiveTab, label: 'Sales & POS', icon: ShoppingCart, visible: true },
    { 
      id: 'inventory' as ActiveTab, 
      label: 'Finished Goods Stock', 
      icon: Package, 
      visible: true,
      badge: lowStockProducts.length > 0 ? `${lowStockProducts.length} Low` : undefined,
      badgeColor: 'rose' as const
    },
    { 
      id: 'raw_materials' as ActiveTab, 
      label: 'Raw Materials', 
      icon: FlaskConical, 
      visible: true,
      badge: lowStockRawMaterials.length > 0 ? `${lowStockRawMaterials.length} Low` : undefined,
      badgeColor: 'amber' as const
    },
    { id: 'formulations' as ActiveTab, label: 'Formulations (BOM)', icon: Layers, visible: true },
    { id: 'production' as ActiveTab, label: 'Production Batches', icon: Factory, visible: true },
    { id: 'purchases' as ActiveTab, label: 'Purchases (Raw/Goods)', icon: Truck, visible: canManagePurchases },
    { id: 'customers' as ActiveTab, label: 'Customers & Ledgers', icon: Users, visible: true },
    { id: 'suppliers' as ActiveTab, label: 'Suppliers & Vendors', icon: Building2, visible: canManagePurchases },
    { id: 'payments' as ActiveTab, label: 'Payments & Cashbook', icon: CreditCard, visible: canManagePurchases },
    { id: 'reports' as ActiveTab, label: 'Financial & Reports', icon: BarChart3, visible: canViewReports },
    { id: 'users' as ActiveTab, label: 'Staff & Roles', icon: ShieldCheck, visible: canManageUsers },
  ];

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'emerald';
      case 'sales_staff': return 'blue';
      case 'accounts_staff': return 'amber';
      default: return 'slate';
    }
  };

  const formatRoleName = (role: string) => {
    switch (role) {
      case 'owner': return 'Owner (Admin)';
      case 'sales_staff': return 'Sales Staff';
      case 'accounts_staff': return 'Accounts Staff';
      default: return 'Plant Staff';
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black text-xl">
          <Sparkles className="w-6 h-6 text-slate-950 fill-current" />
        </div>
        <div>
          <h1 className="font-extrabold text-white text-base tracking-tight leading-none">
            PERFECT SHINE
          </h1>
          <p className="text-[11px] text-emerald-400 font-medium tracking-wider uppercase mt-1">
            Chemicals Lahore
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1.5">
          Factory Modules
        </div>
        {navItems.filter(item => item.visible).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.badgeColor === 'rose' 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Low stock alert banner in sidebar */}
      {totalLowAlerts > 0 && (
        <div className="mx-3 mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Factory Stock Alerts</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-0.5">
            {lowStockProducts.length > 0 && `${lowStockProducts.length} finished goods low. `}
            {lowStockRawMaterials.length > 0 && `${lowStockRawMaterials.length} raw chemicals low.`}
          </p>
        </div>
      )}

      {/* Reset Clean Slate Data Button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => {
            if (confirm('Clear all factory records and reset to a clean slate? All test products, raw materials, payments, and transaction history will be wiped to 0.')) {
              resetToDefaultData();
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 transition-colors border border-rose-500/20"
          title="Reset to clean slate (0 products, 0 raw materials, 0 payments, 0 transactions)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset / Clean Slate</span>
        </button>
      </div>

      {/* Active User Section */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">
              {currentUser.name}
            </p>
            <div className="mt-0.5">
              <Badge variant={getRoleBadgeVariant(currentUser.role)} size="sm">
                {formatRoleName(currentUser.role)}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
