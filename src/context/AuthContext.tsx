import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeRole, type UserRole } from '@/lib/permissions';

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  company_id: string | null; // si está unido a la empresa de otro usuario
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
    setLoading(true); // siempre bloquear antes de verificar para que RoleGuard no redirija
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Intentar obtener perfil de la tabla profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, avatar_url, company_id')
          .eq('id', session.user.id)
          .maybeSingle();

        // Fallback: si no hay perfil, intentar buscar en clients
        if (!profile) {
          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('email', session.user.email)
            .maybeSingle();

          // Si el email coincide con un cliente registrado → rol cliente
          // Si no hay perfil ni coincidencia como cliente, NO se asume admin:
          // se trata como invitado sin acceso hasta que exista una fila real
          // en profiles (evita que un fallo del trigger handle_new_user dé
          // acceso de "empresa" a alguien por defecto).
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: client?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
            role: client ? 'cliente' : 'guest',
            avatar_url: null,
            company_id: null,
          });
        } else {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            full_name: profile.full_name || session.user.user_metadata?.full_name || 'Usuario',
            role: normalizeRole(profile.role),
            avatar_url: profile.avatar_url || null,
            company_id: profile.company_id || null,
          });

          // Si venimos de un registro con código de invitación pendiente
          // (guardado en registro/page.tsx), lo aplicamos ahora que ya
          // hay sesión confirmada.
          const pendingCode = localStorage.getItem('quickly_pending_invite_code');
          if (pendingCode && !profile.company_id) {
            const { data: joinResult } = await supabase.rpc('join_company_by_code', { p_code: pendingCode });
            localStorage.removeItem('quickly_pending_invite_code');
            if (joinResult?.success) {
              // Recargar el perfil para reflejar el company_id recién asignado
              const { data: refreshed } = await supabase
                .from('profiles')
                .select('full_name, role, avatar_url, company_id')
                .eq('id', session.user.id)
                .maybeSingle();
              if (refreshed) {
                setUser(prev => prev ? { ...prev, company_id: refreshed.company_id || null } : prev);
              }
            }
          }
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

  // Sincronizar en tiempo real: si el perfil cambia en la base de datos
  // (por ejemplo, al subir una foto nueva desde Mi Perfil), se refleja al
  // instante aquí también — sin esto, el avatar de la barra superior se
  // quedaba con el dato antiguo hasta recargar la página.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile_sync_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as any;
          setUser(prev => prev ? {
            ...prev,
            full_name: updated.full_name || prev.full_name,
            avatar_url: updated.avatar_url ?? prev.avatar_url,
            role: normalizeRole(updated.role) || prev.role,
            company_id: updated.company_id ?? prev.company_id,
          } : prev);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

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
