import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { MobileNav } from './components/layout/MobileNav';

import { DashboardView } from './components/dashboard/DashboardView';
import { SalesModule } from './components/sales/SalesModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { RawMaterialsModule } from './components/rawMaterials/RawMaterialsModule';
import { FormulationsModule } from './components/formulations/FormulationsModule';
import { ProductionModule } from './components/production/ProductionModule';
import { PurchasesModule } from './components/purchases/PurchasesModule';
import { CustomersModule } from './components/customers/CustomersModule';
import { SuppliersModule } from './components/suppliers/SuppliersModule';
import { PaymentsModule } from './components/payments/PaymentsModule';
import { ExpensesModule } from './components/expenses/ExpensesModule';
import { ReportsModule, ReportType } from './components/reports/ReportsModule';
import { UsersModule } from './components/users/UsersModule';
import { LoginView } from './components/auth/LoginView';
import { useAuth } from './context/AuthContext';
import { WifiOff, Loader2, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [reportsInitialTab, setReportsInitialTab] = useState<ReportType>('sales');
  const [reportsInitialRMId, setReportsInitialRMId] = useState<string | undefined>();
  const { isLoadingCloudData, cloudSyncError, isOnline, refreshCloudData } = useApp();
  const { 
    currentUser, 
    isAuthenticated, 
    allUsers, 
    login,
    canAccessSales,
    canAccessCustomers,
    canAccessProduction,
    canAccessFormulations,
    canAccessRawMaterials,
    canManagePurchases,
    canManageExpenses,
    canViewReports,
    canManageUsers
  } = useAuth();

  // Re-fetch cloud data whenever authenticated user mounts
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      refreshCloudData();
    }
  }, [isAuthenticated, currentUser?.id]);

  if (!isAuthenticated || !currentUser) {
    return <LoginView onLoginSuccess={login} availableProfiles={allUsers} />;
  }

  const renderActiveModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={setActiveTab} />;
      case 'sales':
        return canAccessSales ? <SalesModule /> : <DashboardView onNavigate={setActiveTab} />;
      case 'inventory':
        return <InventoryModule />;
      case 'raw_materials':
        return canAccessRawMaterials ? (
          <RawMaterialsModule 
            onNavigateToPurchaseHistory={(rmId) => {
              setReportsInitialTab('rm_purchases');
              setReportsInitialRMId(rmId);
              setActiveTab('reports');
            }} 
          />
        ) : <DashboardView onNavigate={setActiveTab} />;
      case 'formulations':
        return canAccessFormulations ? <FormulationsModule /> : <DashboardView onNavigate={setActiveTab} />;
      case 'production':
        return canAccessProduction ? (
          <ProductionModule 
            onNavigateToReports={() => {
              setReportsInitialTab('production');
              setActiveTab('reports');
            }} 
          />
        ) : <DashboardView onNavigate={setActiveTab} />;
      case 'purchases':
        return canManagePurchases ? <PurchasesModule /> : <DashboardView onNavigate={setActiveTab} />;
      case 'customers':
        return canAccessCustomers ? <CustomersModule /> : <DashboardView onNavigate={setActiveTab} />;
      case 'suppliers':
        return canManagePurchases ? <SuppliersModule /> : <DashboardView onNavigate={setActiveTab} />;
      case 'payments':
        return canManagePurchases ? <PaymentsModule /> : <DashboardView onNavigate={setActiveTab} />;
      case 'expenses':
        return (canManageExpenses || canViewReports) ? <ExpensesModule /> : <DashboardView onNavigate={setActiveTab} />;
      case 'reports':
        return canViewReports ? (
          <ReportsModule initialReport={reportsInitialTab} initialRawMaterialId={reportsInitialRMId} />
        ) : <DashboardView onNavigate={setActiveTab} />;
      case 'users':
        return canManageUsers ? <UsersModule /> : <DashboardView onNavigate={setActiveTab} />;
      default:
        return <DashboardView onNavigate={setActiveTab} />;
    }
  };

  if (isLoadingCloudData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-5 shadow-2xl shadow-emerald-500/10 animate-pulse">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-white mb-2">Perfect Shine Chemicals</h2>
        <p className="text-xs text-slate-400 font-medium max-w-sm">
          Connecting to Supabase cloud database & retrieving live factory ledgers...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans flex-col">
      {/* Offline Status Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 text-center text-xs flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>You are currently offline. Actions require an active internet connection to sync with the factory database.</span>
        </div>
      )}

      {/* Cloud Sync Error Banner */}
      {cloudSyncError && (
        <div className="bg-rose-500/15 border-b border-rose-500/30 text-rose-300 px-4 py-2.5 text-center text-xs flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2 mx-auto">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{cloudSyncError}</span>
            <button
              onClick={() => refreshCloudData()}
              className="ml-2 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry Sync
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main App Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          {/* Top Header */}
          <Topbar onNavigate={setActiveTab} />

          {/* Dynamic Module Page */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
            {renderActiveModule()}
          </main>

          {/* Handheld Mobile Navigation */}
          <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
