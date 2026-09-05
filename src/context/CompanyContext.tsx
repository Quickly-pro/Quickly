import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { companyInfo } from '@/mocks/company';

export interface CompanyData {
  name: string;
  legalName: string;
  cif: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  logo: string;
  brandColor: string;
  founded: string;
  employees: number;
  clients: number;
  monthlyRevenue: number;
  paymentBizum?: string;
  paymentIban?: string;
  paymentPaypal?: string;
  paymentStripe?: string;
  inviteCode?: string;
}

const STORAGE_KEY = 'quickly_company_data';

function fromDb(row: any): CompanyData {
  return {
    name:           row.name           || companyInfo.name,
    legalName:      row.legal_name     || companyInfo.legalName,
    cif:            row.cif            || companyInfo.cif,
    address:        row.address        || companyInfo.address,
    city:           row.city           || companyInfo.city,
    postalCode:     row.postal_code    || companyInfo.postalCode,
    phone:          row.phone          || companyInfo.phone,
    email:          row.email          || companyInfo.email,
    website:        row.website        || companyInfo.website,
    logo:           row.logo           || companyInfo.logo,
    brandColor:     row.brand_color    || companyInfo.brandColor,
    founded:        row.founded        || companyInfo.founded,
    employees:      row.employees      ?? companyInfo.employees,
    clients:        row.clients        ?? companyInfo.clients,
    monthlyRevenue: row.monthly_revenue ?? companyInfo.monthlyRevenue,
    paymentBizum:   row.payment_bizum  || '',
    paymentIban:    row.payment_iban   || '',
    paymentPaypal:  row.payment_paypal || '',
    paymentStripe:  row.payment_stripe || '',
    inviteCode:     row.invite_code    || '',
  };
}

function toDb(data: Partial<CompanyData>): Record<string, any> {
  const db: Record<string, any> = {};
  if (data.name           !== undefined) db.name            = data.name;
  if (data.legalName      !== undefined) db.legal_name      = data.legalName;
  if (data.cif            !== undefined) db.cif             = data.cif;
  if (data.address        !== undefined) db.address         = data.address;
  if (data.city           !== undefined) db.city            = data.city;
  if (data.postalCode     !== undefined) db.postal_code     = data.postalCode;
  if (data.phone          !== undefined) db.phone           = data.phone;
  if (data.email          !== undefined) db.email           = data.email;
  if (data.website        !== undefined) db.website         = data.website;
  if (data.logo           !== undefined) db.logo            = data.logo;
  if (data.brandColor     !== undefined) db.brand_color     = data.brandColor;
  if (data.founded        !== undefined) db.founded         = data.founded;
  if (data.employees      !== undefined) db.employees       = data.employees;
  if (data.clients        !== undefined) db.clients         = data.clients;
  if (data.monthlyRevenue !== undefined) db.monthly_revenue = data.monthlyRevenue;
  if (data.paymentBizum   !== undefined) db.payment_bizum   = data.paymentBizum;
  if (data.paymentIban    !== undefined) db.payment_iban    = data.paymentIban;
  if (data.paymentPaypal  !== undefined) db.payment_paypal  = data.paymentPaypal;
  if (data.paymentStripe  !== undefined) db.payment_stripe  = data.paymentStripe;
  return db;
}

function loadCache(): CompanyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...companyInfo, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...companyInfo };
}

interface CompanyContextValue {
  data: CompanyData;
  update: (partial: Partial<CompanyData>) => Promise<{ success: boolean; error?: string }>;
  loading: boolean;
  isOwner: boolean;
  ownerId: string | null;
  refetch: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<CompanyData>(loadCache);
  const [loading, setLoading] = useState(true);

  // Si el usuario se unió a otra empresa con un código, todas las
  // lecturas/escrituras de "empresa" deben apuntar al dueño original,
  // no a su propia fila (que estaría vacía).
  const effectiveOwnerId = user?.company_id || user?.id || null;
  const isOwner = !user?.company_id;

  const fetchFromDb = useCallback(async () => {
    if (!effectiveOwnerId) {
      setLoading(false);
      return;
    }
    try {
      const { data: row, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', effectiveOwnerId)
        .maybeSingle();

      if (!error && row) {
        const mapped = fromDb(row);
        setData(mapped);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      }
    } catch {
      // Si falla Supabase, usa el caché de localStorage
    } finally {
      setLoading(false);
    }
  }, [effectiveOwnerId]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchFromDb();
  }, [user, fetchFromDb]);

  const update = useCallback(async (partial: Partial<CompanyData>): Promise<{ success: boolean; error?: string }> => {
    if (!effectiveOwnerId) {
      return { success: false, error: 'No hay una empresa asociada a tu cuenta todavía' };
    }

    const dbFields = toDb(partial);
    if (Object.keys(dbFields).length === 0) return { success: true };

    const { error } = await supabase
      .from('company_settings')
      .upsert(
        { user_id: effectiveOwnerId, ...dbFields, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error guardando datos de empresa:', error);
      return { success: false, error: error.message || 'No se pudieron guardar los cambios' };
    }

    // Solo se actualiza el estado local (y la caché) UNA VEZ confirmado que
    // Supabase guardó de verdad — antes se actualizaba antes de comprobarlo,
    // por lo que un fallo silencioso hacía parecer que se había guardado.
    setData((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    return { success: true };
  }, [effectiveOwnerId]);

  return (
    <CompanyContext.Provider value={{ data, update, loading, isOwner, ownerId: effectiveOwnerId, refetch: fetchFromDb }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompanyContext must be used inside CompanyProvider');
  return ctx;
}
