import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, UserRole } from '../types';
import { INITIAL_PROFILES } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../lib/supabaseService';
import { generateId } from '../utils/uuid';

interface AuthContextType {
  currentUser: Profile;
  allUsers: Profile[];
  switchUser: (userId: string) => void;
  updateUserRole: (userId: string, newRole: UserRole) => void;
  updateUser: (userId: string, updates: Partial<Profile>) => void;
  addUser: (user: Omit<Profile, 'id' | 'created_at'>) => void;
  toggleUserStatus: (userId: string) => void;
  deleteUser: (userId: string) => void;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('psc_users');
    return saved ? JSON.parse(saved) : INITIAL_PROFILES;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem('psc_current_user_id');
    return saved || INITIAL_PROFILES[0].id;
  });

  useEffect(() => {
    let isMounted = true;
    const loadProfiles = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0 && isMounted) {
          setAllUsers(data as Profile[]);
        }
      } catch (err) {
        console.error('Failed to load profiles from Supabase:', err);
      }
    };
    loadProfiles();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('psc-profiles-cloud')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          loadProfiles();
        })
        .subscribe();

      return () => {
        isMounted = false;
        if (supabase) supabase.removeChannel(channel);
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Save only active user selection for browser session persistence
  useEffect(() => {
    localStorage.setItem('psc_current_user_id', currentUserId);
  }, [currentUserId]);

  const currentUser = allUsers.find(u => u.id === currentUserId) || allUsers[0];

  const switchUser = (userId: string) => {
    const target = allUsers.find(u => u.id === userId);
    if (target && !target.is_deactivated && target.is_active) {
      setCurrentUserId(userId);
    } else if (target && (target.is_deactivated || !target.is_active)) {
      alert(`Account "${target.name}" is deactivated. Please reactivate it from Staff Management before logging in.`);
    }
  };

  const updateUserRole = (userId: string, newRole: UserRole) => {
    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const updated = { ...u, role: newRole, updated_at: new Date().toISOString() };
        supabaseService.upsertProfile(updated);
        return updated;
      }
      return u;
    }));
  };

  const updateUser = (userId: string, updates: Partial<Profile>) => {
    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const updated = { ...u, ...updates, updated_at: new Date().toISOString() };
        supabaseService.upsertProfile(updated);
        return updated;
      }
      return u;
    }));
  };

  const addUser = (userData: Omit<Profile, 'id' | 'created_at'>) => {
    const newUser: Profile = {
      ...userData,
      id: generateId(),
      is_active: true,
      is_deactivated: false,
      created_at: new Date().toISOString(),
    };
    setAllUsers(prev => [...prev, newUser]);
    supabaseService.upsertProfile(newUser);
  };

  const toggleUserStatus = (userId: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextActive = !u.is_active;
        const updated = { 
          ...u, 
          is_active: nextActive, 
          is_deactivated: !nextActive, 
          updated_at: new Date().toISOString() 
        };
        supabaseService.upsertProfile(updated);
        return updated;
      }
      return u;
    }));
  };

  const deleteUser = (userId: string) => {
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    supabaseService.deleteProfile(userId);
  };

  const role = currentUser.role;
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

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        switchUser,
        updateUserRole,
        updateUser,
        addUser,
        toggleUserStatus,
        deleteUser,
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
