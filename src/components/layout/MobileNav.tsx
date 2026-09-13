import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Truck, 
  FlaskConical,
  Factory,
  BarChart3 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ActiveTab } from './Sidebar';

interface MobileNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
  const { canViewReports, canManagePurchases, canRecordProduction, canManageRawMaterials } = useAuth();

  const items = [
    { id: 'dashboard' as ActiveTab, label: 'Home', icon: LayoutDashboard },
    { id: 'sales' as ActiveTab, label: 'Sales', icon: ShoppingCart },
    { id: 'inventory' as ActiveTab, label: 'Finished', icon: Package },
    { id: 'raw_materials' as ActiveTab, label: 'Raw Stock', icon: FlaskConical },
    { id: 'production' as ActiveTab, label: 'Production', icon: Factory },
    ...(canViewReports ? [{ id: 'reports' as ActiveTab, label: 'Reports', icon: BarChart3 }] : []),
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-1 py-1.5 flex items-center justify-around shadow-lg">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all ${
              isActive ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[9px] mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
