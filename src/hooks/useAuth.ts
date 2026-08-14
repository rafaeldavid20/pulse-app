'use client';

import { useState, useEffect } from 'react';
import { getStoredUser, UserProfile } from '@/lib/auth';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch from stored user
    setUser(getStoredUser());
    setLoading(false);

    const handleAuthChange = () => {
      setUser(getStoredUser());
    };

    window.addEventListener('pulse_auth_changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('pulse_auth_changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
  };
}
