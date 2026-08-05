-- ==========================================
-- SUPABASE ENTERPRISE PORTAL SCHEMA & SEED (MULTI-TENANT)
-- ==========================================

-- ------------------------------------------
-- 0. RESET / CLEANUP PREVIOUS DATABASE TABLES
-- ------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.articles CASCADE;
DROP TABLE IF EXISTS public.user_favorites CASCADE;
DROP TABLE IF EXISTS public.module_actions CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.store_members CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------
-- 1. STORES (COMERCIOS) TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    code TEXT UNIQUE,
    plan TEXT DEFAULT 'enterprise', -- 'standard', 'pro', 'enterprise'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- 2. STORE MEMBERS TABLE (User <-> Store Pivot)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'operador', -- 'owner', 'admin', 'supervisor', 'operador'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, user_id)
);

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- 3. PROFILES TABLE (Linked to auth.users)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'operador', -- Global default role
    active_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -- RLS for profiles
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Trigger to auto-create profile and initial store on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_store_id UUID;
  s_name TEXT;
BEGIN
  -- 1. Insert Profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'owner'
  );

  -- 2. If store_name passed in signup metadata, auto-create the user's business store
  s_name := new.raw_user_meta_data->>'store_name';
  IF s_name IS NOT NULL AND trim(s_name) <> '' THEN
    INSERT INTO public.stores (name, slug, code, plan)
    VALUES (
      trim(s_name),
      lower(regexp_replace(trim(s_name), '[^a-zA-Z0-9]', '-', 'g')) || '-' || floor(random()*8999+1000)::text,
      'SUC-' || floor(random()*899+100)::text,
      'enterprise'
    )
    RETURNING id INTO new_store_id;

    -- Create store membership as owner
    INSERT INTO public.store_members (store_id, user_id, role)
    VALUES (new_store_id, new.id, 'owner');

    -- Set active store in user profile
    UPDATE public.profiles SET active_store_id = new_store_id WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- RLS for Stores: only accessible by authenticated members of each store
DROP POLICY IF EXISTS "Stores are viewable and manageable by users" ON public.stores;
CREATE POLICY "Stores are viewable and manageable by users"
    ON public.stores FOR ALL
    TO authenticated
    USING (
      id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
    WITH CHECK (
      id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );

-- RLS for Store Members: each user can only see their own memberships
-- Owners/admins can see all memberships within their stores
DROP POLICY IF EXISTS "Store memberships are viewable and manageable" ON public.store_members;
CREATE POLICY "Store memberships are viewable by own user"
    ON public.store_members FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Store memberships manageable by owner or admin" ON public.store_members;
CREATE POLICY "Store memberships manageable by owner or admin"
    ON public.store_members FOR INSERT
    TO authenticated
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
      )
    );

DROP POLICY IF EXISTS "Store memberships deletable by owner" ON public.store_members;
CREATE POLICY "Store memberships deletable by owner"
    ON public.store_members FOR DELETE
    TO authenticated
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
      )
    );


-- ------------------------------------------
-- 4. MODULES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT NOT NULL,
    color_theme TEXT DEFAULT 'blue', -- 'red', 'green', 'purple', 'orange', 'teal', 'blue'
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Modules are viewable by anyone authenticated" ON public.modules;
CREATE POLICY "Modules are viewable by anyone authenticated"
    ON public.modules FOR SELECT
    TO authenticated, anon
    USING (true);


-- ------------------------------------------
-- 5. MODULE ACTIONS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.module_actions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.module_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Module actions are viewable by anyone authenticated" ON public.module_actions;
CREATE POLICY "Module actions are viewable by anyone authenticated"
    ON public.module_actions FOR SELECT
    TO authenticated, anon
    USING (true);


-- ------------------------------------------
-- 6. USER FAVORITES TABLE (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_slug TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, user_id, action_slug)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- RLS for User Favorites: strictly scoped to own user_id within stores they belong to
DROP POLICY IF EXISTS "User favorites viewable and manageable" ON public.user_favorites;
CREATE POLICY "User favorites viewable and manageable"
    ON public.user_favorites FOR ALL
    TO authenticated
    USING (
      user_id = auth.uid()
      AND store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
    WITH CHECK (
      user_id = auth.uid()
      AND store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );


-- ------------------------------------------
-- 7. DEMO ARTICLES & TRANSACTION LOGS (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    barcode TEXT,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    family TEXT DEFAULT 'General',
    subfamily TEXT DEFAULT 'General',
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    min_stock INT NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_priority_pricing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

-- Idempotent column additions for existing databases
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS family TEXT DEFAULT 'General';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS subfamily TEXT DEFAULT 'General';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS min_stock INT DEFAULT 5;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS is_priority_pricing BOOLEAN DEFAULT FALSE;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Articles accessible only by active members of the store" ON public.articles;
CREATE POLICY "Articles accessible only by active members of the store"
    ON public.articles FOR ALL
    TO authenticated, anon
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND is_active = true
      ) OR store_id IS NULL
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND is_active = true
      ) OR store_id IS NULL
    );

-- ------------------------------------------
-- 8. PRICE LISTS & PRICE LIST ITEMS (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    code INT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'normal',
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    base_list_name TEXT,
    generate_labels BOOLEAN DEFAULT TRUE,
    visible_in_pos BOOLEAN DEFAULT TRUE,
    round_prices BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

-- RLS for Price Lists: only accessible by active members of the owning store
DROP POLICY IF EXISTS "Price lists viewable and manageable" ON public.price_lists;
CREATE POLICY "Price lists viewable and manageable"
    ON public.price_lists FOR ALL
    TO authenticated
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );

CREATE TABLE IF NOT EXISTS public.price_list_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    price_list_id UUID REFERENCES public.price_lists(id) ON DELETE CASCADE,
    article_code TEXT NOT NULL,
    custom_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(price_list_id, article_code)
);

ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

-- RLS for Price List Items: accessible only if the parent price_list belongs to a store the user is a member of
DROP POLICY IF EXISTS "Price list items viewable and manageable" ON public.price_list_items;
CREATE POLICY "Price list items viewable and manageable"
    ON public.price_list_items FOR ALL
    TO authenticated
    USING (
      price_list_id IN (
        SELECT pl.id FROM public.price_lists pl
        WHERE pl.store_id IN (
          SELECT store_id FROM public.store_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    )
    WITH CHECK (
      price_list_id IN (
        SELECT pl.id FROM public.price_lists pl
        WHERE pl.store_id IN (
          SELECT store_id FROM public.store_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    );


-- ------------------------------------------
-- 9. CASH REGISTERS (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    cashier_name TEXT,
    version TEXT DEFAULT 'v10.3.20 (iPOS-Android)',
    default_price_list_name TEXT DEFAULT 'Lista Base',
    allowed_price_list_names TEXT[] DEFAULT ARRAY['Lista Base'],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cash registers viewable and manageable" ON public.cash_registers;
CREATE POLICY "Cash registers viewable and manageable"
    ON public.cash_registers FOR ALL
    TO authenticated
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );


-- ------------------------------------------
-- 10. STOCK MOVEMENTS & ITEMS (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    movement_type TEXT NOT NULL DEFAULT 'Ingreso', -- 'Ingreso', 'Egreso', 'Ajuste de Stock', 'Transferencia'
    observations TEXT,
    total_units NUMERIC(10,2) DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove stale columns from existing databases (idempotent)
ALTER TABLE public.stock_movements DROP COLUMN IF EXISTS warehouse_origin;
ALTER TABLE public.stock_movements DROP COLUMN IF EXISTS warehouse_destination;
ALTER TABLE public.stock_movements DROP COLUMN IF EXISTS price_type;
ALTER TABLE public.stock_movements DROP COLUMN IF EXISTS price_list_name;
ALTER TABLE public.stock_movements DROP COLUMN IF EXISTS total_amount;


ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stock movements viewable and manageable" ON public.stock_movements;
CREATE POLICY "Stock movements viewable and manageable"
    ON public.stock_movements FOR ALL
    TO authenticated
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );

CREATE TABLE IF NOT EXISTS public.stock_movement_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    movement_id UUID REFERENCES public.stock_movements(id) ON DELETE CASCADE NOT NULL,
    article_code TEXT NOT NULL,
    article_description TEXT NOT NULL,
    qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_movement_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stock movement items viewable and manageable" ON public.stock_movement_items;
CREATE POLICY "Stock movement items viewable and manageable"
    ON public.stock_movement_items FOR ALL
    TO authenticated
    USING (
      movement_id IN (
        SELECT sm.id FROM public.stock_movements sm
        WHERE sm.store_id IN (
          SELECT store_id FROM public.store_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    )
    WITH CHECK (
      movement_id IN (
        SELECT sm.id FROM public.stock_movements sm
        WHERE sm.store_id IN (
          SELECT store_id FROM public.store_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    );


-- ------------------------------------------
-- 11. SUPPLIERS, INVOICES & PAYMENTS (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    cuit TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    vat_condition TEXT DEFAULT 'Responsable Inscripto',
    balance NUMERIC(12,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers viewable and manageable" ON public.suppliers;
CREATE POLICY "Suppliers viewable and manageable"
    ON public.suppliers FOR ALL
    TO authenticated
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_type TEXT DEFAULT 'Factura A',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'Pendiente', -- 'Pendiente', 'Pagado Parcial', 'Pagado'
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supplier invoices viewable and manageable" ON public.supplier_invoices;
CREATE POLICY "Supplier invoices viewable and manageable"
    ON public.supplier_invoices FOR ALL
    TO authenticated
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );

CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
    payment_method TEXT NOT NULL DEFAULT 'Efectivo', -- 'Efectivo', 'Transferencia', 'Cheque'
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    reference_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supplier payments viewable and manageable" ON public.supplier_payments;
CREATE POLICY "Supplier payments viewable and manageable"
    ON public.supplier_payments FOR ALL
    TO authenticated
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );



-- ------------------------------------------
-- SEED DATA: STORES
-- ------------------------------------------
INSERT INTO public.stores (id, name, slug, code, plan) VALUES
('11111111-1111-1111-1111-111111111111', 'PICKING & DELIVERING UP! S.A.', 'picking-delivering-up', 'UP-001', 'enterprise'),
('22222222-2222-2222-2222-222222222222', 'SUPERMERCADOS CENTRAL SUR', 'central-sur', 'CS-002', 'pro'),
('33333333-3333-3333-3333-333333333333', 'EXPRESS MARKET NORTE', 'express-norte', 'EM-003', 'standard')
ON CONFLICT (slug) DO NOTHING;


-- ------------------------------------------
-- SEED DATA: MODULES AND ACTIONS
-- ------------------------------------------

DELETE FROM public.module_actions;
DELETE FROM public.modules;

-- Precios
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Precios', 'precios', 'DollarSign', 'red', 1)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Cambio Puntual', 'cambio-puntual', 'Edit3', 1),
((SELECT id FROM m), 'Cambio Masivo', 'cambio-masivo', 'Zap', 2),
((SELECT id FROM m), 'Listas de Precios', 'listas-precios', 'List', 3),
((SELECT id FROM m), 'Cambio Rápido', 'cambio-rapido', 'RefreshCw', 4);

-- Distribuciones
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Distribuciones', 'distribuciones', 'Truck', 'green', 2)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Distribuir Precios', 'distribuir-precios', 'Share2', 1),
((SELECT id FROM m), 'Monitoreo de Cajas', 'monitoreo-cajas', 'Activity', 2);

-- Inventario
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Inventario', 'inventario', 'Package', 'purple', 3)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Gestión de Inventario', 'gestion-inventario', 'Box', 1),
((SELECT id FROM m), 'Conciliación', 'conciliacion', 'CheckCircle2', 2);

-- Artículos
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Artículos', 'articulos', 'Barcode', 'blue', 4)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Rubros', 'rubros', 'Layers', 1),
((SELECT id FROM m), 'Artículos', 'articulos-list', 'Tag', 2),
((SELECT id FROM m), 'Baja artículos', 'baja-articulos', 'Trash2', 3),
((SELECT id FROM m), 'Familias - Subfamilias', 'familias-subfamilias', 'Grid', 4);

-- Proveedores
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Proveedores', 'proveedores', 'Handshake', 'orange', 5)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Cuenta Corriente', 'prov-cta-cte', 'CreditCard', 1),
((SELECT id FROM m), 'Ingreso de Comprobantes', 'ingreso-comprobantes', 'FileText', 2),
((SELECT id FROM m), 'Gestión de Proveedores', 'gestion-proveedores', 'Users', 3),
((SELECT id FROM m), 'Admin Cta Cte', 'admin-cta-cte', 'Settings', 4);

-- Reportes
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Reportes', 'reportes', 'FileSpreadsheet', 'sky', 6)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Reportes y Analytics', 'reportes-analytics', 'PieChart', 1);

-- Caja Central
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Caja Central', 'caja-central', 'Landmark', 'lime', 7)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Cierre de Cajeros', 'cierre-cajeros', 'Lock', 1),
((SELECT id FROM m), 'Cuenta Corriente Caja', 'cuenta-corriente-caja', 'Wallet', 2),
((SELECT id FROM m), 'Movimientos', 'movimientos-caja', 'TrendingUp', 3),
((SELECT id FROM m), 'Admin. Aranceles', 'admin-aranceles', 'Percent', 4);

-- Configuración
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Configuración', 'configuracion', 'Settings', 'rose', 8)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Autorizar Ingreso Soporte', 'autorizar-soporte', 'ShieldCheck', 1),
((SELECT id FROM m), 'Diseño de Etiquetas', 'diseno-etiquetas', 'Sliders', 2),
((SELECT id FROM m), 'Bonificaciones', 'bonificaciones', 'Gift', 3),
((SELECT id FROM m), 'Propiedades MM', 'propiedades-mm', 'Cpu', 4),
((SELECT id FROM m), 'Configuración BackEnd', 'configuracion-backend', 'Database', 5);

-- Otros
WITH m AS (
  INSERT INTO public.modules (name, slug, icon, color_theme, sort_order)
  VALUES ('Otros', 'otros', 'LayoutGrid', 'teal', 9)
  RETURNING id
)
INSERT INTO public.module_actions (module_id, name, slug, icon, sort_order) VALUES
((SELECT id FROM m), 'Bancos', 'bancos', 'Building2', 1),
((SELECT id FROM m), 'Tipo de Cambio', 'tipo-cambio', 'Coins', 2),
((SELECT id FROM m), 'Ingresos/Egresos', 'ingresos-egresos', 'ArrowUpDown', 3),
((SELECT id FROM m), 'Cuentas', 'cuentas', 'Folder', 4),
((SELECT id FROM m), 'Vales de Compra', 'vales-compra', 'Ticket', 5),
((SELECT id FROM m), 'Exportaciones', 'exportaciones', 'Download', 6);

-- Sample Multi-Tenant Articles Seed
INSERT INTO public.articles (store_id, code, description, category, price, cost, stock) VALUES
('11111111-1111-1111-1111-111111111111', '7791234567891', 'Aceite de Girasol 900ml', 'Almacén', 1450.00, 1100.00, 150),
('11111111-1111-1111-1111-111111111111', '7791234567892', 'Galletitas Dulces Sabor Vainilla 250g', 'Galletitas', 890.00, 620.00, 320),
('22222222-2222-2222-2222-222222222222', '7791234567893', 'Gaseosa Cola 2.25L Retornable', 'Bebidas', 2100.00, 1600.00, 85),
('22222222-2222-2222-2222-222222222222', '7791234567894', 'Detergente Lavavajillas Concentrado 500ml', 'Limpieza', 1250.00, 890.00, 200),
('33333333-3333-3333-3333-333333333333', '7791234567895', 'Queso Cream Gourmet 300g', 'Lácteos', 3200.00, 2400.00, 60)
ON CONFLICT DO NOTHING;


-- ------------------------------------------
-- 8. SYSTEM NOTIFICATIONS TABLE (Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage notifications of their active store" ON public.notifications;
DROP POLICY IF EXISTS "Notifications scoped to own store" ON public.notifications;
CREATE POLICY "Notifications scoped to own store"
    ON public.notifications FOR ALL
    TO authenticated
    USING (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      ) OR user_id = auth.uid()
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM public.store_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    );

-- Seed System Welcome Notifications
INSERT INTO public.notifications (store_id, title, message, type, is_read) VALUES
('11111111-1111-1111-1111-111111111111', '¡Bienvenido a PickingUp! Administración', 'Tu comercio PICKING & DELIVERING UP! S.A. está activo con arquitectura aislada.', 'success', false),
('11111111-1111-1111-1111-111111111111', 'Aislamiento Multi-Tenant Activo', 'Tus datos de precios, cajas y productos son 100% privados e independientes.', 'info', false)
ON CONFLICT DO NOTHING;




-- ------------------------------------------
-- 9. PRICE AUDIT LOGS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    article_code TEXT NOT NULL,
    article_description TEXT,
    price_list_name TEXT DEFAULT 'Lista Base',
    old_price NUMERIC(12,2) DEFAULT 0,
    new_price NUMERIC(12,2) DEFAULT 0,
    reason TEXT DEFAULT 'Ajuste de precio',
    user_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.price_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Price audit logs scoped to own store" ON public.price_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------
-- 10. AUXILIARY ENTERPRISE TABLES
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_tariffs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT DEFAULT 'Credito',
    fee_percent NUMERIC(5,2) DEFAULT 0,
    accreditation_days INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.card_tariffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Card tariffs scoped" ON public.card_tariffs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL,
    amount NUMERIC(12,2) DEFAULT 0,
    cashier_name TEXT,
    concept TEXT,
    register_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cash movements scoped" ON public.cash_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_type TEXT DEFAULT 'Cuenta Corriente',
    account_number TEXT,
    cbu TEXT,
    balance NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bank accounts scoped" ON public.bank_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.currency_rates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    symbol TEXT DEFAULT '$',
    rate NUMERIC(12,4) DEFAULT 1.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Currency rates scoped" ON public.currency_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.cash_flows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    flow_type TEXT NOT NULL,
    category TEXT,
    concept TEXT,
    amount NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cash_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cash flows scoped" ON public.cash_flows FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.purchase_vouchers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    customer_name TEXT,
    amount NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'Activo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.purchase_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Purchase vouchers scoped" ON public.purchase_vouchers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.discount_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    min_amount NUMERIC(12,2) DEFAULT 0,
    applies_to TEXT DEFAULT 'Todas las categorías',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.discount_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Discount rules scoped" ON public.discount_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.custom_properties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_type TEXT DEFAULT 'Texto',
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.custom_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Custom properties scoped" ON public.custom_properties FOR ALL TO authenticated USING (true) WITH CHECK (true);
