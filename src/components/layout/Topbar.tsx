import React, { useState } from 'react';
import { 
  Bell, 
  UserCheck, 
  Sparkles, 
  AlertTriangle, 
  Database,
  ChevronDown,
  FlaskConical,
  Package,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { ActiveTab } from './Sidebar';

interface TopbarProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onNavigate }) => {
  const { currentUser, allUsers, switchUser, logout } = useAuth();
  const { lowStockProducts, lowStockRawMaterials } = useApp();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const totalAlerts = lowStockProducts.length + lowStockRawMaterials.length;

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Mobile Brand / Title */}
      <div className="flex items-center gap-3">
        <img 
          src="/assets/logo.png" 
          alt="Perfect Shine Chemicals" 
          className="md:hidden w-8 h-8 object-contain shrink-0 drop-shadow" 
        />
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Perfect Shine Chemicals</span>
            <span className="hidden sm:inline-block text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Lahore Plant
            </span>
          </h2>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Supabase connection indicator */}
        <div 
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
            isSupabaseConfigured 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
          title={isSupabaseConfigured ? "Connected to live Supabase Postgres" : "Operating in local persistent offline mode (Supabase ready)"}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{isSupabaseConfigured ? 'Supabase Live' : 'Offline / Local DB'}</span>
        </div>

        {/* Low stock notifications button */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative"
            title="Stock alerts"
          >
            <Bell className="w-5 h-5" />
            {totalAlerts > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div 
              className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-black/50 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              onClick={() => setShowNotifications(false)}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Stock Alerts & Reorders</span>
                <span className="text-[11px] text-slate-400">{totalAlerts} items low</span>
              </div>
              <div className="py-2 max-h-72 overflow-y-auto space-y-1.5">
                {totalAlerts === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">All factory stock levels are optimal 👍</p>
                ) : (
                  <>
                    {/* Finished Goods Alerts */}
                    {lowStockProducts.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => onNavigate('inventory')}
                        className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs flex items-start gap-2.5 cursor-pointer hover:bg-rose-500/20 transition-colors"
                      >
                        <Package className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">{p.name}</p>
                          <p className="text-rose-300 text-[11px]">
                            Finished Stock: {p.current_stock} {p.base_unit || p.unit} (Threshold: {p.reorder_level})
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Raw Material Alerts */}
                    {lowStockRawMaterials.map(rm => (
                      <div 
                        key={rm.id}
                        onClick={() => onNavigate('raw_materials')}
                        className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-start gap-2.5 cursor-pointer hover:bg-amber-500/20 transition-colors"
                      >
                        <FlaskConical className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">{rm.name}</p>
                          <p className="text-amber-300 text-[11px]">
                            Raw Material Stock: {rm.current_stock} {rm.unit} (Threshold: {rm.reorder_level})
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role Switcher & User Profile */}
        {currentUser && (
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 transition-colors"
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline font-medium">{currentUser.name.split(' ')[0]}</span>
              <span className="text-slate-400 hidden md:inline">({currentUser.role.replace('_', ' ')})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Direct Logout Button */}
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to end your session and log out?')) {
                  logout();
                }
              }}
              title="Secure Sign Out"
              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline text-[11px] font-semibold">Logout</span>
            </button>

            {showRoleMenu && (
              <div 
                className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-black/50 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                onClick={() => setShowRoleMenu(false)}
              >
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1 flex items-center justify-between">
                  <span>Switch Shift / User</span>
                  <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
                </div>
                {allUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => switchUser(u.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      u.id === currentUser.id 
                        ? 'bg-emerald-500/15 text-emerald-400 font-semibold' 
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div>
                      <p>{u.name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{u.role.replace('_', ' ')}</p>
                    </div>
                    {u.id === currentUser.id && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                  </button>
                ))}

                <div className="border-t border-slate-800 mt-2 pt-2">
                  <button
                    onClick={() => logout()}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of System</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
