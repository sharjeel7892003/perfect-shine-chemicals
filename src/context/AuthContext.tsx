import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, UserRole } from '../types';
import { INITIAL_PROFILES } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../lib/supabaseService';
import { generateId } from '../utils/uuid';

const LEGACY_ID_MAP: Record<string, string> = {
  'user-1': 'a1b2c3d4-e5f6-4a7b-8c9d-000000000001',
  'user-2': 'a1b2c3d4-e5f6-4a7b-8c9d-000000000002',
  'user-3': 'a1b2c3d4-e5f6-4a7b-8c9d-000000000003',
  'user-4': 'a1b2c3d4-e5f6-4a7b-8c9d-000000000004',
};

interface AuthContextType {
  currentUser: Profile;
  allUsers: Profile[];
  isAuthenticated: boolean;
  login: (profile: Profile) => void;
  logout: () => Promise<void>;
  switchUser: (userId: string) => void;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  updateUser: (userId: string, updates: Partial<Profile>) => Promise<void>;
  addUser: (user: Omit<Profile, 'id' | 'created_at'>) => Promise<void>;
  toggleUserStatus: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  isOwner: boolean;
  canManageProducts: boolean;
  canCreateSale: boolean;
  canManagePurchases: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canAdjustStock: boolean;
  canManageFormulations: boolean;
  canRecordProduction: boolean;
  canManageRawMaterials: boolean;
  canManageExpenses: boolean;
  canAccessSales: boolean;
  canAccessCustomers: boolean;
  canAccessProduction: boolean;
  canAccessFormulations: boolean;
  canAccessRawMaterials: boolean;
  canDeleteData: boolean;
}

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<Profile[]>(INITIAL_PROFILES);

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('psc_current_user_id') : null;
    if (saved && LEGACY_ID_MAP[saved]) return LEGACY_ID_MAP[saved];
    return saved || '';
  });

  const loadProfiles = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Notice loading profiles from Supabase:', error.message);
        return;
      }

      if (data && data.length > 0) {
        setAllUsers(data as Profile[]);
      } else {
        // If Supabase profiles table is empty, seed the initial profiles
        for (const profile of INITIAL_PROFILES) {
          await supabaseService.upsertProfile(profile).catch(() => {});
        }
        const recheck = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
        if (recheck.data && recheck.data.length > 0) {
          setAllUsers(recheck.data as Profile[]);
        }
      }
    } catch (err) {
      console.error('Failed to load profiles from Supabase:', err);
    }
  }, []);

  useEffect(() => {
    loadProfiles();

    // 1. Subscribe to Supabase Realtime for instant multi-device sync
    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel('psc-profiles-cloud')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
          console.log('[Supabase Realtime] Profile change received:', payload);
          loadProfiles();
        })
        .subscribe();
    }

    // 2. Re-fetch when user switches back to tab or device wakes from sleep
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadProfiles();
      }
    };
    const handleFocus = () => {
      loadProfiles();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [loadProfiles]);

  // Save active user selection for browser session persistence
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (currentUserId) {
        localStorage.setItem('psc_current_user_id', currentUserId);
      } else {
        localStorage.removeItem('psc_current_user_id');
      }
    }
  }, [currentUserId]);

  // Synchronize with live Supabase Auth session
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user) {
          const email = data.session.user.email?.toLowerCase();
          const match = allUsers.find(u => u.email?.toLowerCase() === email || u.id === data.session.user.id);
          if (match && !match.is_deactivated && match.is_active) {
            setCurrentUserId(match.id);
          }
        }
      }).catch(() => {});

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const email = session.user.email?.toLowerCase();
          const match = allUsers.find(u => u.email?.toLowerCase() === email || u.id === session.user.id);
          if (match && !match.is_deactivated && match.is_active) {
            setCurrentUserId(match.id);
          }
        } else if (_event === 'SIGNED_OUT') {
          setCurrentUserId('');
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe();
      };
    }
  }, [allUsers]);

  // 30-Minute Inactivity Session Expiry
  useEffect(() => {
    if (!currentUserId) return;

    let timeoutId: any = null;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert('Your session has expired due to 30 minutes of inactivity. Please sign in again.');
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [currentUserId]);

  const currentUser = allUsers.find(u => u.id === currentUserId) || allUsers[0] || INITIAL_PROFILES[0];
  const isAuthenticated = Boolean(currentUserId && allUsers.some(u => u.id === currentUserId && !u.is_deactivated && u.is_active));

  const login = (profile: Profile) => {
    setCurrentUserId(profile.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('psc_current_user_id', profile.id);
    }
  };

  const logout = async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('psc_current_user_id');
      localStorage.removeItem('sb-yvltxrilzhoisljjgyrh-auth-token');
      sessionStorage.clear();
      window.history.replaceState(null, '', window.location.pathname);
    }
    setCurrentUserId('');
  };

  const switchUser = (userId: string) => {
    const target = allUsers.find(u => u.id === userId);
    if (target && !target.is_deactivated && target.is_active) {
      setCurrentUserId(userId);
    } else if (target && (target.is_deactivated || !target.is_active)) {
      alert(`Account "${target.name}" is deactivated. Please reactivate it from Staff Management before logging in.`);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole): Promise<void> => {
    const target = allUsers.find(u => u.id === userId);
    if (!target) return;
    const updated: Profile = { ...target, role: newRole, updated_at: new Date().toISOString() };
    setAllUsers(prev => prev.map(u => u.id === userId ? updated : u));
    await supabaseService.upsertProfile(updated);
  };

  const updateUser = async (userId: string, updates: Partial<Profile>): Promise<void> => {
    const target = allUsers.find(u => u.id === userId);
    if (!target) return;
    const updated: Profile = { ...target, ...updates, updated_at: new Date().toISOString() };
    
    // Immediate optimistic local UI update
    setAllUsers(prev => prev.map(u => u.id === userId ? updated : u));
    
    // Cloud database persistence
    await supabaseService.upsertProfile(updated);
  };

  const addUser = async (userData: Omit<Profile, 'id' | 'created_at'>): Promise<void> => {
    const newUser: Profile = {
      ...userData,
      id: generateId(),
      is_active: true,
      is_deactivated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAllUsers(prev => [...prev, newUser]);
    await supabaseService.upsertProfile(newUser);
  };

  const toggleUserStatus = async (userId: string): Promise<void> => {
    const target = allUsers.find(u => u.id === userId);
    if (!target) return;
    const nextActive = !target.is_active;
    const updated: Profile = { 
      ...target, 
      is_active: nextActive, 
      is_deactivated: !nextActive, 
      updated_at: new Date().toISOString() 
    };
    setAllUsers(prev => prev.map(u => u.id === userId ? updated : u));
    await supabaseService.upsertProfile(updated);
  };

  const deleteUser = async (userId: string): Promise<void> => {
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    await supabaseService.deleteProfile(userId);
  };

  const role = currentUser?.role;
  const isOwner = role === 'owner';
  const canManageProducts = role === 'owner' || role === 'accounts_staff' || role === 'general_staff';
  const canCreateSale = role === 'owner' || role === 'sales_staff';
  const canManagePurchases = role === 'owner' || role === 'accounts_staff';
  const canViewReports = role === 'owner' || role === 'accounts_staff';
  const canManageUsers = role === 'owner';
  const canAdjustStock = role === 'owner' || role === 'accounts_staff' || role === 'general_staff' || role === 'sales_staff';
  const canManageFormulations = role === 'owner';
  const canRecordProduction = role === 'owner' || role === 'general_staff' || role === 'accounts_staff';
  const canManageRawMaterials = role === 'owner' || role === 'accounts_staff' || role === 'general_staff';
  const canManageExpenses = role === 'owner' || role === 'accounts_staff';
  const canAccessSales = role === 'owner' || role === 'sales_staff' || role === 'accounts_staff';
  const canAccessCustomers = role === 'owner' || role === 'sales_staff' || role === 'accounts_staff';
  const canAccessProduction = role === 'owner' || role === 'general_staff' || role === 'accounts_staff';
  const canAccessFormulations = role === 'owner' || role === 'general_staff';
  const canAccessRawMaterials = role === 'owner' || role === 'general_staff' || role === 'accounts_staff';
  const canDeleteData = role === 'owner';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isAuthenticated,
        login,
        logout,
        switchUser,
        updateUserRole,
        updateUser,
        addUser,
        toggleUserStatus,
        deleteUser,
        refreshProfiles: loadProfiles,
        isOwner,
        canManageProducts,
        canCreateSale,
        canManagePurchases,
        canViewReports,
        canManageUsers,
        canAdjustStock,
        canManageFormulations,
        canRecordProduction,
        canManageRawMaterials,
        canManageExpenses,
        canAccessSales,
        canAccessCustomers,
        canAccessProduction,
        canAccessFormulations,
        canAccessRawMaterials,
        canDeleteData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
