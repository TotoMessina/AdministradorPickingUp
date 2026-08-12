import { supabase, isValidUUID } from '../lib/supabase';

export interface Customer {
  id: string;
  store_id: string;
  code: string;
  name: string;
  cuit?: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  loyalty_points: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const STORAGE_KEY = (storeId: string) => `pickingup_customers_${storeId}`;

const DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    store_id: '11111111-1111-1111-1111-111111111111',
    code: 'CLI-001',
    name: 'Juan Pérez (Empresa Constructora)',
    cuit: '20-34567890-9',
    phone: '+54 9 11 4455-6677',
    email: 'juan.perez@constructora.com',
    address: 'Av. Corrientes 1234, CABA',
    balance: 15400.00,
    loyalty_points: 350,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    store_id: '11111111-1111-1111-1111-111111111111',
    code: 'CLI-002',
    name: 'María González (Gastronomía)',
    cuit: '27-28901234-4',
    phone: '+54 9 11 5566-7788',
    email: 'mgonzalez@restogourmet.com',
    address: 'Calle Palermo 567, CABA',
    balance: 0.00,
    loyalty_points: 120,
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    store_id: '11111111-1111-1111-1111-111111111111',
    code: 'CLI-003',
    name: 'Consumidor Final',
    cuit: '00-00000000-0',
    phone: '',
    email: '',
    address: '',
    balance: 0.00,
    loyalty_points: 0,
    is_active: true,
    created_at: new Date().toISOString()
  }
];

export const fetchCustomers = async (storeId?: string): Promise<Customer[]> => {
  const storeKey = storeId || 'demo-store';

  if (storeId && isValidUUID(storeId)) {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId)
        .order('name', { ascending: true });

      if (!error && data) {
        localStorage.setItem(STORAGE_KEY(storeKey), JSON.stringify(data));
        return data as Customer[];
      }
    } catch (err) {
      console.warn('Supabase customers fetch error, using local fallback:', err);
    }
  }

  // Fallback to local storage or demo data
  try {
    const raw = localStorage.getItem(STORAGE_KEY(storeKey));
    if (raw) return JSON.parse(raw);
  } catch {}

  localStorage.setItem(STORAGE_KEY(storeKey), JSON.stringify(DEMO_CUSTOMERS));
  return DEMO_CUSTOMERS;
};

export const saveCustomer = async (customer: Partial<Customer> & { store_id: string; name: string; code: string }): Promise<Customer> => {
  const storeKey = customer.store_id || 'demo-store';

  if (customer.store_id && isValidUUID(customer.store_id)) {
    try {
      if (customer.id && isValidUUID(customer.id)) {
        const { data, error } = await supabase
          .from('customers')
          .update({
            code: customer.code,
            name: customer.name,
            cuit: customer.cuit || null,
            phone: customer.phone || null,
            email: customer.email || null,
            address: customer.address || null,
            balance: customer.balance ?? 0,
            loyalty_points: customer.loyalty_points ?? 0,
            is_active: customer.is_active ?? true,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)
          .select()
          .single();

        if (!error && data) {
          await syncLocalCustomers(storeKey);
          return data as Customer;
        }
      } else {
        const { data, error } = await supabase
          .from('customers')
          .insert([{
            store_id: customer.store_id,
            code: customer.code,
            name: customer.name,
            cuit: customer.cuit || null,
            phone: customer.phone || null,
            email: customer.email || null,
            address: customer.address || null,
            balance: customer.balance ?? 0,
            loyalty_points: customer.loyalty_points ?? 0,
            is_active: customer.is_active ?? true
          }])
          .select()
          .single();

        if (!error && data) {
          await syncLocalCustomers(storeKey);
          return data as Customer;
        }
      }
    } catch (err) {
      console.warn('Supabase customer save error, saving locally:', err);
    }
  }

  // Local Storage Fallback
  const existing = await fetchCustomers(storeKey);
  let updated: Customer;

  if (customer.id) {
    const idx = existing.findIndex(c => c.id === customer.id);
    if (idx >= 0) {
      updated = { ...existing[idx], ...customer, updated_at: new Date().toISOString() } as Customer;
      existing[idx] = updated;
    } else {
      updated = { id: customer.id, ...customer, balance: customer.balance ?? 0, loyalty_points: customer.loyalty_points ?? 0, is_active: customer.is_active ?? true, created_at: new Date().toISOString() } as Customer;
      existing.push(updated);
    }
  } else {
    updated = {
      id: 'cli_' + Date.now(),
      ...customer,
      balance: customer.balance ?? 0,
      loyalty_points: customer.loyalty_points ?? 0,
      is_active: customer.is_active ?? true,
      created_at: new Date().toISOString()
    } as Customer;
    existing.push(updated);
  }

  localStorage.setItem(STORAGE_KEY(storeKey), JSON.stringify(existing));
  return updated;
};

export const recordCustomerPayment = async (customerId: string, storeId: string, amount: number): Promise<boolean> => {
  const storeKey = storeId || 'demo-store';

  if (storeId && isValidUUID(storeId) && isValidUUID(customerId)) {
    try {
      const { data: curr } = await supabase
        .from('customers')
        .select('balance')
        .eq('id', customerId)
        .single();

      const newBalance = Math.max(0, Number(curr?.balance || 0) - amount);

      const { error } = await supabase
        .from('customers')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', customerId);

      if (!error) return true;
    } catch {}
  }

  // Local storage fallback
  const list = await fetchCustomers(storeKey);
  const target = list.find(c => c.id === customerId);
  if (target) {
    target.balance = Math.max(0, Number(target.balance || 0) - amount);
    localStorage.setItem(STORAGE_KEY(storeKey), JSON.stringify(list));
    return true;
  }
  return false;
};

export const updateCustomerPoints = async (customerId: string, storeId: string, pointsEarned: number): Promise<boolean> => {
  const storeKey = storeId || 'demo-store';

  if (storeId && isValidUUID(storeId) && isValidUUID(customerId)) {
    try {
      const { data: curr } = await supabase
        .from('customers')
        .select('loyalty_points')
        .eq('id', customerId)
        .single();

      const newPoints = Number(curr?.loyalty_points || 0) + pointsEarned;

      const { error } = await supabase
        .from('customers')
        .update({ loyalty_points: newPoints, updated_at: new Date().toISOString() })
        .eq('id', customerId);

      if (!error) return true;
    } catch {}
  }

  // Local storage fallback
  const list = await fetchCustomers(storeKey);
  const target = list.find(c => c.id === customerId);
  if (target) {
    target.loyalty_points = (target.loyalty_points || 0) + pointsEarned;
    localStorage.setItem(STORAGE_KEY(storeKey), JSON.stringify(list));
    return true;
  }
  return false;
};

const syncLocalCustomers = async (storeId: string) => {
  try {
    const { data } = await supabase.from('customers').select('*').eq('store_id', storeId);
    if (data) {
      localStorage.setItem(STORAGE_KEY(storeId), JSON.stringify(data));
    }
  } catch {}
};
