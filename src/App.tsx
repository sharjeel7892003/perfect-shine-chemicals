import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
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
import { ReportsModule } from './components/reports/ReportsModule';
import { UsersModule } from './components/users/UsersModule';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const renderActiveModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={setActiveTab} />;
      case 'sales':
        return <SalesModule />;
      case 'inventory':
        return <InventoryModule />;
      case 'raw_materials':
        return <RawMaterialsModule />;
      case 'formulations':
        return <FormulationsModule />;
      case 'production':
        return <ProductionModule />;
      case 'purchases':
        return <PurchasesModule />;
      case 'customers':
        return <CustomersModule />;
      case 'suppliers':
        return <SuppliersModule />;
      case 'payments':
        return <PaymentsModule />;
      case 'reports':
        return <ReportsModule />;
      case 'users':
        return <UsersModule />;
      default:
        return <DashboardView onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
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
