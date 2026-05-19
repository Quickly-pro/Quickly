import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
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
}

const STORAGE_KEY = 'quickly_company_data';

function fromDb(row: any): CompanyData {
  return {
    name:           row.name          || companyInfo.name,
    legalName:      row.legal_name    || companyInfo.legalName,
    cif:            row.cif           || companyInfo.cif,
    address:        row.address       || companyInfo.address,
    city:           row.city          || companyInfo.city,
    postalCode:     row.postal_code   || companyInfo.postalCode,
    phone:          row.phone         || companyInfo.phone,
    email:          row.email         || companyInfo.email,
    website:        row.website       || companyInfo.website,
    logo:           row.logo          || companyInfo.logo,
    brandColor:     row.brand_color   || companyInfo.brandColor,
    founded:        row.founded       || companyInfo.founded,
    employees:      row.employees     ?? companyInfo.employees,
    clients:        row.clients       ?? companyInfo.clients,
    monthlyRevenue: row.monthly_revenue ?? companyInfo.monthlyRevenue,
    paymentBizum:   row.payment_bizum  || '',
    paymentIban:    row.payment_iban   || '',
    paymentPaypal:  row.payment_paypal || '',
    paymentStripe:  row.payment_stripe || '',
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

export function useCompany() {
  const { user } = useAuth();
  const [data, setData] = useState<CompanyData>(loadCache);
  const [loading, setLoading] = useState(true);

  // Carga los datos desde Supabase al iniciar sesión
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchFromDb = async () => {
      try {
        const { data: row, error } = await supabase
          .from('company_settings')
          .select('*')
          .eq('user_id', user.id)
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
    };

    fetchFromDb();
  }, [user]);

  const update = useCallback(async (partial: Partial<CompanyData>) => {
    // Actualiza estado y caché local inmediatamente (UI fluida)
    setData((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    // Guarda en Supabase si hay usuario
    if (!user) return;

    const dbFields = toDb(partial);
    if (Object.keys(dbFields).length === 0) return;

    await supabase
      .from('company_settings')
      .upsert(
        { user_id: user.id, ...dbFields, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  }, [user]);

  return { data, update, loading };
}
