import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeRole, type UserRole } from '@/lib/permissions';

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Intentar obtener perfil de la tabla profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle();

        // Fallback: si no hay perfil, intentar buscar en clients
        if (!profile) {
          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('email', session.user.email)
            .maybeSingle();

          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: client?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
            role: 'cliente',
            avatar_url: null,
          });
        } else {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: profile.full_name || session.user.user_metadata?.full_name || 'Usuario',
            role: normalizeRole(profile.role),
            avatar_url: profile.avatar_url || null,
          });
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}