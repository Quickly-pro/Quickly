import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  bio: string;
  avatar_url: string | null;
  avatar_crop_data: { scale?: number; offsetX?: number; offsetY?: number };
  created_at: string;
  updated_at: string;
}

const EMPTY_PROFILE: Profile = {
  id: '',
  full_name: '',
  email: '',
  phone: '',
  role: '',
  department: '',
  bio: '',
  avatar_url: null,
  avatar_crop_data: {},
  created_at: '',
  updated_at: '',
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error cargando perfil:', error);
      }

      if (data) {
        setProfile({ ...EMPTY_PROFILE, ...data });
      } else {
        // Crear perfil si no existe
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || '',
            email: user.email || '',
            role: user.user_metadata?.role || 'client',
          })
          .select('*')
          .maybeSingle();

        if (newProfile) {
          setProfile({ ...EMPTY_PROFILE, ...newProfile });
        }
      }
    } catch (err) {
      console.error('Error en fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        return false;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('Error actualizando perfil:', error);
        setSaving(false);
        return false;
      }

      await fetchProfile();
      setSaving(false);
      return true;
    } catch (err) {
      console.error('Error en updateProfile:', err);
      setSaving(false);
      return false;
    }
  }, [fetchProfile]);

  const updateAvatar = useCallback(async (avatarUrl: string, cropData?: { scale: number; offsetX: number; offsetY: number }) => {
    const MAX_RETRIES = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'No hay sesión activa' };

        const updates: Record<string, unknown> = { avatar_url: avatarUrl };
        if (cropData) {
          updates.avatar_crop_data = cropData;
        }

        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);

        if (error) {
          console.error(`Error actualizando avatar (intento ${attempt}):`, error);
          lastError = error;
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, attempt * 800));
            continue;
          }
          return { success: false, error: String(error.message || error) };
        }

        await fetchProfile();
        return { success: true, error: null };
      } catch (err) {
        console.error(`Error en updateAvatar (intento ${attempt}):`, err);
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 800));
          continue;
        }
        return { success: false, error: String(err) };
      }
    }

    return { success: false, error: String(lastError) };
  }, [fetchProfile]);

  return {
    profile,
    loading,
    saving,
    updateProfile,
    updateAvatar,
    refreshProfile: fetchProfile,
  };
}