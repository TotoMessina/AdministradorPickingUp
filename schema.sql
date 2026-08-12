-- ==========================================
-- SUPABASE ENTERPRISE PORTAL SCHEMA & SEED (MULTI-TENANT)
-- ==========================================

-- ------------------------------------------
-- 0. RESET / CLEANUP PREVIOUS DATABASE TABLES, FUNCTIONS & TYPES
-- ------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.validate_profile_active_store() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_last_owner_deletion() CASCADE;
DROP FUNCTION IF EXISTS public.sync_supplier_balance() CASCADE;
DROP FUNCTION IF EXISTS public.apply_stock_movement() CASCADE;

DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.price_audit_logs CASCADE;
DROP TABLE IF EXISTS public.sales_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.sales_closures CASCADE;
DROP TABLE IF EXISTS public.stock_movement_items CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.supplier_payments CASCADE;
DROP TABLE IF EXISTS public.supplier_invoices CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.cash_registers CASCADE;
DROP TABLE IF EXISTS public.price_list_items CASCADE;
DROP TABLE IF EXISTS public.price_lists CASCADE;
DROP TABLE IF EXISTS public.articles CASCADE;
DROP TABLE IF EXISTS public.user_favorites CASCADE;
DROP TABLE IF EXISTS public.card_tariffs CASCADE;
DROP TABLE IF EXISTS public.cash_movements CASCADE;
DROP TABLE IF EXISTS public.bank_accounts CASCADE;
DROP TABLE IF EXISTS public.currency_rates CASCADE;
DROP TABLE IF EXISTS public.cash_flows CASCADE;
DROP TABLE IF EXISTS public.purchase_vouchers CASCADE;
DROP TABLE IF EXISTS public.discount_rules CASCADE;
DROP TABLE IF EXISTS public.custom_properties CASCADE;
DROP TABLE IF EXISTS public.module_actions CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.store_members CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;
DROP TABLE IF EXISTS public.platform_admins CASCADE;

DROP TYPE IF EXISTS public.store_plan_type CASCADE;
DROP TYPE IF EXISTS public.user_role_type CASCADE;
DROP TYPE IF EXISTS public.stock_movement_enum CASCADE;
DROP TYPE IF EXISTS public.invoice_type_enum CASCADE;
DROP TYPE IF EXISTS public.invoice_status_enum CASCADE;
DROP TYPE IF EXISTS public.payment_method_enum CASCADE;
DROP TYPE IF EXISTS public.notification_type_enum CASCADE;
DROP TYPE IF EXISTS public.price_list_type_enum CASCADE;
DROP TYPE IF EXISTS public.purchase_voucher_status_enum CASCADE;
DROP TYPE IF EXISTS public.card_tariff_type_enum CASCADE;

-- ------------------------------------------
-- DOMAIN ENUM TYPES
-- ------------------------------------------
CREATE TYPE public.store_plan_type AS ENUM ('standard', 'pro', 'enterprise');
CREATE TYPE public.user_role_type AS ENUM ('owner', 'admin', 'supervisor', 'operador');
CREATE TYPE public.stock_movement_enum AS ENUM ('Ingreso', 'Egreso', 'Ajuste de Stock', 'Transferencia');
CREATE TYPE public.invoice_type_enum AS ENUM ('Factura A', 'Factura B', 'Factura C', 'Nota de Débito', 'Nota de Crédito');
CREATE TYPE public.invoice_status_enum AS ENUM ('Pendiente', 'Pagado Parcial', 'Pagado');
CREATE TYPE public.payment_method_enum AS ENUM ('Efectivo', 'Transferencia', 'Cheque', 'Tarjeta');
CREATE TYPE public.notification_type_enum AS ENUM ('info', 'success', 'warning', 'error');
CREATE TYPE public.price_list_type_enum AS ENUM ('normal', 'porcentual');
CREATE TYPE public.purchase_voucher_status_enum AS ENUM ('Activo', 'Usado', 'Vencido');
CREATE TYPE public.card_tariff_type_enum AS ENUM ('Credito', 'Debito');


-- ------------------------------------------
-- 1. BASE TABLES & TENANCY (CREATED FIRST FOR DEPENDENCY RESOLUTION)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    code TEXT UNIQUE,
    plan public.store_plan_type DEFAULT 'enterprise',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.store_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.user_role_type DEFAULT 'operador',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, user_id)
);

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role public.user_role_type DEFAULT 'operador',
    active_store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    theme_preference TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------
-- 2. REUSABLE RLS & TRIGGER HELPER FUNCTIONS
-- ------------------------------------------

-- Helper: Check if current user is an authorized platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper: Get store IDs where current user is an active member OR platform admin (Optimized with set_config transaction cache & JWT claims)
CREATE OR REPLACE FUNCTION public.get_my_store_ids()
RETURNS SETOF UUID AS $$
DECLARE
  _cached TEXT;
  _claims_ids JSONB;
BEGIN
  -- 1. Try transaction memory cache
  _cached := current_setting('request.my_store_ids', true);
  IF _cached IS NOT NULL AND _cached <> '' THEN
    RETURN QUERY SELECT unnest(string_to_array(_cached, ',')::UUID[]);
    RETURN;
  END IF;

  -- 2. Try JWT claims fallback
  _claims_ids := COALESCE(
    auth.jwt() -> 'app_metadata' -> 'store_ids',
    auth.jwt() -> 'user_metadata' -> 'store_ids'
  );
  IF _claims_ids IS NOT NULL AND jsonb_array_length(_claims_ids) > 0 THEN
    PERFORM set_config('request.my_store_ids', array_to_string(ARRAY(SELECT jsonb_array_elements_text(_claims_ids)), ','), true);
    RETURN QUERY SELECT jsonb_array_elements_text(_claims_ids)::UUID;
    RETURN;
  END IF;

  -- 3. Query store_members with index and cache result for transaction
  IF public.is_platform_admin() THEN
    PERFORM set_config('request.my_store_ids', array_to_string(ARRAY(SELECT id FROM public.stores), ','), true);
    RETURN QUERY SELECT id FROM public.stores;
  ELSE
    PERFORM set_config('request.my_store_ids', array_to_string(ARRAY(
      SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND is_active = true
    ), ','), true);
    RETURN QUERY SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND is_active = true;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper: Get store IDs where current user is owner/admin OR platform admin (Optimized with set_config transaction cache)
CREATE OR REPLACE FUNCTION public.get_my_admin_store_ids()
RETURNS SETOF UUID AS $$
DECLARE
  _cached TEXT;
BEGIN
  _cached := current_setting('request.my_admin_store_ids', true);
  IF _cached IS NOT NULL AND _cached <> '' THEN
    RETURN QUERY SELECT unnest(string_to_array(_cached, ',')::UUID[]);
    RETURN;
  END IF;

  IF public.is_platform_admin() THEN
    PERFORM set_config('request.my_admin_store_ids', array_to_string(ARRAY(SELECT id FROM public.stores), ','), true);
    RETURN QUERY SELECT id FROM public.stores;
  ELSE
    PERFORM set_config('request.my_admin_store_ids', array_to_string(ARRAY(
      SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    ), ','), true);
    RETURN QUERY SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper: Get store IDs where current user is owner/admin/supervisor OR platform admin (Optimized with set_config transaction cache)
CREATE OR REPLACE FUNCTION public.get_my_management_store_ids()
RETURNS SETOF UUID AS $$
DECLARE
  _cached TEXT;
BEGIN
  _cached := current_setting('request.my_mgmt_store_ids', true);
  IF _cached IS NOT NULL AND _cached <> '' THEN
    RETURN QUERY SELECT unnest(string_to_array(_cached, ',')::UUID[]);
    RETURN;
  END IF;

  IF public.is_platform_admin() THEN
    PERFORM set_config('request.my_mgmt_store_ids', array_to_string(ARRAY(SELECT id FROM public.stores), ','), true);
    RETURN QUERY SELECT id FROM public.stores;
  ELSE
    PERFORM set_config('request.my_mgmt_store_ids', array_to_string(ARRAY(
      SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'supervisor') AND is_active = true
    ), ','), true);
    RETURN QUERY SELECT store_id FROM public.store_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'supervisor') AND is_active = true;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER SET search_path = public, pg_temp;

-- Generic Trigger: Refresh updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Trigger: Prevent deletion or deactivation of the last owner of a store
CREATE OR REPLACE FUNCTION public.prevent_last_owner_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    IF (SELECT COUNT(*) FROM public.store_members WHERE store_id = OLD.store_id AND role = 'owner' AND is_active = true AND id <> OLD.id) = 0 THEN
      RAISE EXCEPTION 'Cannot delete or deactivate the last active owner of store %. Transfer store ownership first.', OLD.store_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Active store membership validation trigger
CREATE OR REPLACE FUNCTION public.validate_profile_active_store()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.active_store_id IS NOT NULL AND (OLD.active_store_id IS DISTINCT FROM NEW.active_store_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.store_members 
      WHERE store_id = NEW.active_store_id AND user_id = NEW.id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'User % is not an active member of store %', NEW.id, NEW.active_store_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Trigger to auto-create profile and initial store on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_store_id UUID;
  s_name TEXT;
  user_role_val public.user_role_type;
BEGIN
  s_name := new.raw_user_meta_data->>'store_name';
  
  -- Determine profile role based on registration context
  IF s_name IS NOT NULL AND trim(s_name) <> '' THEN
    user_role_val := 'owner'::public.user_role_type;
  ELSE
    user_role_val := COALESCE((new.raw_user_meta_data->>'role')::public.user_role_type, 'operador'::public.user_role_type);
  END IF;

  -- 1. Insert Profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    user_role_val
  );

  -- 2. If store_name passed in signup metadata, auto-create the user's business store
  IF s_name IS NOT NULL AND trim(s_name) <> '' THEN
    INSERT INTO public.stores (name, slug, code, plan)
    VALUES (
      trim(s_name),
      lower(regexp_replace(trim(s_name), '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
      'SUC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ------------------------------------------
-- 3. POLICIES & TRIGGERS FOR BASE TABLES
-- ------------------------------------------
DROP POLICY IF EXISTS "Platform admins viewable by authenticated users" ON public.platform_admins;
CREATE POLICY "Platform admins viewable by authenticated users"
    ON public.platform_admins FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Stores viewable by store members" ON public.stores;
CREATE POLICY "Stores viewable by store members"
    ON public.stores FOR SELECT
    TO authenticated
    USING (id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Stores manageable only by owner or admin" ON public.stores;
CREATE POLICY "Stores manageable only by owner or admin"
    ON public.stores FOR ALL
    TO authenticated
    USING (id IN (SELECT public.get_my_admin_store_ids()))
    WITH CHECK (id IN (SELECT public.get_my_admin_store_ids()));

DROP POLICY IF EXISTS "Store memberships viewable by store members" ON public.store_members;
CREATE POLICY "Store memberships viewable by store members"
    ON public.store_members FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Store memberships manageable only by store admin" ON public.store_members;
CREATE POLICY "Store memberships manageable only by store admin"
    ON public.store_members FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_admin_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_admin_store_ids()));

DROP TRIGGER IF EXISTS enforce_last_owner ON public.store_members;
CREATE TRIGGER enforce_last_owner
  BEFORE DELETE OR UPDATE ON public.store_members
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_last_owner_deletion();

-- PII Protected Profile Select: Only self or active store teammates
DROP POLICY IF EXISTS "Profiles viewable only by self or teammates" ON public.profiles;
CREATE POLICY "Profiles viewable only by self or teammates"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
      id = auth.uid() 
      OR id IN (
        SELECT user_id FROM public.store_members 
        WHERE store_id IN (SELECT public.get_my_store_ids())
      )
    );

-- Privilege Escalation Protected Update
DROP POLICY IF EXISTS "Users can update own profile fields" ON public.profiles;
CREATE POLICY "Users can update own profile fields"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
      auth.uid() = id 
      AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
      AND email IS NOT DISTINCT FROM (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS check_profile_active_store ON public.profiles;
CREATE TRIGGER check_profile_active_store
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.validate_profile_active_store();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ------------------------------------------
-- 4. MODULES & MODULE ACTIONS TABLES
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT NOT NULL,
    color_theme TEXT DEFAULT 'blue',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Modules are viewable by authenticated users" ON public.modules;
CREATE POLICY "Modules are viewable by authenticated users"
    ON public.modules FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE TABLE IF NOT EXISTS public.module_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.module_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Module actions viewable by authenticated users" ON public.module_actions;
CREATE POLICY "Module actions viewable by authenticated users"
    ON public.module_actions FOR SELECT
    TO authenticated, anon
    USING (true);


-- ------------------------------------------
-- 5. USER FAVORITES TABLE (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action_slug TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, user_id, action_slug)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User favorites viewable and manageable by own user" ON public.user_favorites;
CREATE POLICY "User favorites viewable and manageable by own user"
    ON public.user_favorites FOR ALL
    TO authenticated
    USING (
      user_id = auth.uid() AND store_id IN (SELECT public.get_my_store_ids())
    )
    WITH CHECK (
      user_id = auth.uid() AND store_id IN (SELECT public.get_my_store_ids())
    );


-- ------------------------------------------
-- 6. ARTICLES TABLE (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    barcode TEXT,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    family TEXT DEFAULT 'General',
    subfamily TEXT DEFAULT 'General',
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    cost NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock INT NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_priority_pricing BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_articles_updated_at ON public.articles;
CREATE TRIGGER set_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Articles viewable by active store members" ON public.articles;
CREATE POLICY "Articles viewable by active store members"
    ON public.articles FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Articles manageable by store management roles" ON public.articles;
CREATE POLICY "Articles manageable by store management roles"
    ON public.articles FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));


-- ------------------------------------------
-- 7. PRICE LISTS & PRICE LIST ITEMS (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    code INT NOT NULL,
    name TEXT NOT NULL,
    type public.price_list_type_enum DEFAULT 'normal',
    discount_percent NUMERIC(5,2) DEFAULT 0.00 CHECK (discount_percent BETWEEN 0 AND 100),
    base_list_name TEXT,
    generate_labels BOOLEAN DEFAULT TRUE,
    visible_in_pos BOOLEAN DEFAULT TRUE,
    round_prices BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

-- Partial Unique Index: Exactly one default price list per store
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_lists_one_default_per_store
  ON public.price_lists(store_id) WHERE is_default = true;

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_price_lists_updated_at ON public.price_lists;
CREATE TRIGGER set_price_lists_updated_at
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Price lists viewable by store members" ON public.price_lists;
CREATE POLICY "Price lists viewable by store members"
    ON public.price_lists FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Price lists manageable by store management" ON public.price_lists;
CREATE POLICY "Price lists manageable by store management"
    ON public.price_lists FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

CREATE TABLE IF NOT EXISTS public.price_list_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    price_list_id UUID REFERENCES public.price_lists(id) ON DELETE CASCADE NOT NULL,
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
    article_code TEXT NOT NULL,
    custom_price NUMERIC(10,2) NOT NULL CHECK (custom_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(price_list_id, article_id)
);

ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Price list items viewable by store members" ON public.price_list_items;
CREATE POLICY "Price list items viewable by store members"
    ON public.price_list_items FOR SELECT
    TO authenticated
    USING (
      price_list_id IN (
        SELECT pl.id FROM public.price_lists pl
        WHERE pl.store_id IN (SELECT public.get_my_store_ids())
      )
    );

DROP POLICY IF EXISTS "Price list items manageable by store management" ON public.price_list_items;
CREATE POLICY "Price list items manageable by store management"
    ON public.price_list_items FOR ALL
    TO authenticated
    USING (
      price_list_id IN (
        SELECT pl.id FROM public.price_lists pl
        WHERE pl.store_id IN (SELECT public.get_my_management_store_ids())
      )
    )
    WITH CHECK (
      price_list_id IN (
        SELECT pl.id FROM public.price_lists pl
        WHERE pl.store_id IN (SELECT public.get_my_management_store_ids())
      )
    );


-- ------------------------------------------
-- 8. CASH REGISTERS (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    cashier_name TEXT,
    version TEXT DEFAULT 'v10.3.20 (iPOS-Android)',
    default_price_list_name TEXT DEFAULT 'Lista Base',
    allowed_price_list_names TEXT[] DEFAULT ARRAY['Lista Base'],
    allowed_price_list_ids UUID[],
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_cash_registers_updated_at ON public.cash_registers;
CREATE TRIGGER set_cash_registers_updated_at
  BEFORE UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Cash registers viewable by store members" ON public.cash_registers;
CREATE POLICY "Cash registers viewable by store members"
    ON public.cash_registers FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Cash registers manageable by store management" ON public.cash_registers;
CREATE POLICY "Cash registers manageable by store management"
    ON public.cash_registers FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));


-- ------------------------------------------
-- 9. STOCK MOVEMENTS & ITEMS (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    movement_type public.stock_movement_enum DEFAULT 'Ingreso',
    observations TEXT,
    total_units NUMERIC(10,2) DEFAULT 0 CHECK (total_units >= 0),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stock movements viewable by store members" ON public.stock_movements;
CREATE POLICY "Stock movements viewable by store members"
    ON public.stock_movements FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Stock movements manageable by store management" ON public.stock_movements;
CREATE POLICY "Stock movements manageable by store management"
    ON public.stock_movements FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

CREATE TABLE IF NOT EXISTS public.stock_movement_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    movement_id UUID REFERENCES public.stock_movements(id) ON DELETE CASCADE NOT NULL,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    article_code TEXT NOT NULL,
    article_description TEXT NOT NULL,
    qty NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (qty > 0),
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_movement_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stock movement items viewable by store members" ON public.stock_movement_items;
CREATE POLICY "Stock movement items viewable by store members"
    ON public.stock_movement_items FOR SELECT
    TO authenticated
    USING (
      movement_id IN (
        SELECT sm.id FROM public.stock_movements sm
        WHERE sm.store_id IN (SELECT public.get_my_store_ids())
      )
    );

DROP POLICY IF EXISTS "Stock movement items manageable by store management" ON public.stock_movement_items;
CREATE POLICY "Stock movement items manageable by store management"
    ON public.stock_movement_items FOR ALL
    TO authenticated
    USING (
      movement_id IN (
        SELECT sm.id FROM public.stock_movements sm
        WHERE sm.store_id IN (SELECT public.get_my_management_store_ids())
      )
    )
    WITH CHECK (
      movement_id IN (
        SELECT sm.id FROM public.stock_movements sm
        WHERE sm.store_id IN (SELECT public.get_my_management_store_ids())
      )
    );

-- Atomic Inventory Trigger
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  m_type public.stock_movement_enum;
BEGIN
  SELECT movement_type INTO m_type
  FROM public.stock_movements
  WHERE id = NEW.movement_id;

  IF m_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.article_id IS NOT NULL THEN
    IF m_type = 'Ingreso' THEN
      UPDATE public.articles
      SET stock = stock + NEW.qty, updated_at = NOW()
      WHERE id = NEW.article_id;
    ELSIF m_type IN ('Egreso', 'Transferencia') THEN
      UPDATE public.articles
      SET stock = GREATEST(0, stock - NEW.qty), updated_at = NOW()
      WHERE id = NEW.article_id;
    ELSIF m_type = 'Ajuste de Stock' THEN
      UPDATE public.articles
      SET stock = GREATEST(0, NEW.qty::int), updated_at = NOW()
      WHERE id = NEW.article_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS sync_stock_movement_items ON public.stock_movement_items;
CREATE TRIGGER sync_stock_movement_items
  AFTER INSERT ON public.stock_movement_items
  FOR EACH ROW EXECUTE PROCEDURE public.apply_stock_movement();


-- ------------------------------------------
-- 10. SUPPLIERS, INVOICES & PAYMENTS (Store Multi-Tenant with Soft Delete)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Suppliers viewable by store members" ON public.suppliers;
CREATE POLICY "Suppliers viewable by store members"
    ON public.suppliers FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Suppliers manageable by store management" ON public.suppliers;
CREATE POLICY "Suppliers manageable by store management"
    ON public.suppliers FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_type public.invoice_type_enum DEFAULT 'Factura A',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0 AND paid_amount <= amount),
    status public.invoice_status_enum DEFAULT 'Pendiente',
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supplier invoices viewable by store members" ON public.supplier_invoices;
CREATE POLICY "Supplier invoices viewable by store members"
    ON public.supplier_invoices FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()) AND is_active = true);

DROP POLICY IF EXISTS "Supplier invoices manageable by store management" ON public.supplier_invoices;
CREATE POLICY "Supplier invoices manageable by store management"
    ON public.supplier_invoices FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
    payment_method public.payment_method_enum DEFAULT 'Efectivo',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    reference_number TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Supplier payments viewable by store members" ON public.supplier_payments;
CREATE POLICY "Supplier payments viewable by store members"
    ON public.supplier_payments FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()) AND is_active = true);

DROP POLICY IF EXISTS "Supplier payments manageable by store management" ON public.supplier_payments;
CREATE POLICY "Supplier payments manageable by store management"
    ON public.supplier_payments FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

-- Atomic Supplier Balance Calculation Trigger Function
CREATE OR REPLACE FUNCTION public.sync_supplier_balance()
RETURNS TRIGGER AS $$
DECLARE
  target_supplier_id UUID;
  total_invoiced NUMERIC(12,2);
  total_paid NUMERIC(12,2);
BEGIN
  target_supplier_id := COALESCE(NEW.supplier_id, OLD.supplier_id);
  IF target_supplier_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_invoiced
    FROM public.supplier_invoices
    WHERE supplier_id = target_supplier_id AND is_active = true;
    
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.supplier_payments
    WHERE supplier_id = target_supplier_id AND is_active = true;
    
    UPDATE public.suppliers
    SET balance = total_invoiced - total_paid,
        updated_at = NOW()
    WHERE id = target_supplier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS sync_supplier_balance_invoices ON public.supplier_invoices;
CREATE TRIGGER sync_supplier_balance_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoices
  FOR EACH ROW EXECUTE PROCEDURE public.sync_supplier_balance();

DROP TRIGGER IF EXISTS sync_supplier_balance_payments ON public.supplier_payments;
CREATE TRIGGER sync_supplier_balance_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments
  FOR EACH ROW EXECUTE PROCEDURE public.sync_supplier_balance();


-- ------------------------------------------
-- 10.5. CUSTOMERS TABLE (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    cuit TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    balance NUMERIC(12,2) DEFAULT 0.00,
    loyalty_points INT DEFAULT 0 CHECK (loyalty_points >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Customers viewable by store members" ON public.customers;
CREATE POLICY "Customers viewable by store members"
    ON public.customers FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Customers manageable by store management" ON public.customers;
CREATE POLICY "Customers manageable by store management"
    ON public.customers FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));


-- ------------------------------------------
-- 11. SYSTEM NOTIFICATIONS TABLE (Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type public.notification_type_enum DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications scoped to active store members or own user" ON public.notifications;
CREATE POLICY "Notifications scoped to active store members or own user"
    ON public.notifications FOR ALL
    TO authenticated
    USING (
      store_id IN (SELECT public.get_my_store_ids()) OR user_id = auth.uid()
    )
    WITH CHECK (
      store_id IN (SELECT public.get_my_store_ids()) OR user_id = auth.uid()
    );


-- ------------------------------------------
-- 12. PRICE AUDIT LOGS TABLE (Inmutable Audit Trail)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    article_code TEXT NOT NULL,
    article_description TEXT,
    price_list_name TEXT DEFAULT 'Lista Base',
    old_price NUMERIC(12,2) DEFAULT 0 CHECK (old_price >= 0),
    new_price NUMERIC(12,2) DEFAULT 0 CHECK (new_price >= 0),
    reason TEXT DEFAULT 'Ajuste de precio',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.price_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Price audit logs viewable by store members" ON public.price_audit_logs;
CREATE POLICY "Price audit logs viewable by store members"
    ON public.price_audit_logs FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Price audit logs insertable by store management" ON public.price_audit_logs;
CREATE POLICY "Price audit logs insertable by store management"
    ON public.price_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));


-- ------------------------------------------
-- 13. AUXILIARY ENTERPRISE TABLES
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_tariffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type public.card_tariff_type_enum DEFAULT 'Credito',
    fee_percent NUMERIC(5,2) DEFAULT 0 CHECK (fee_percent BETWEEN 0 AND 100),
    accreditation_days INT DEFAULT 1 CHECK (accreditation_days >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);
ALTER TABLE public.card_tariffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Card tariffs viewable by store members" ON public.card_tariffs;
CREATE POLICY "Card tariffs viewable by store members"
    ON public.card_tariffs FOR SELECT TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Card tariffs manageable by store admins" ON public.card_tariffs;
CREATE POLICY "Card tariffs manageable by store admins"
    ON public.card_tariffs FOR ALL TO authenticated
    USING (store_id IN (SELECT public.get_my_admin_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_admin_store_ids()));

CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    movement_type TEXT NOT NULL,
    amount NUMERIC(12,2) DEFAULT 0,
    cashier_name TEXT,
    concept TEXT,
    register_code TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_cash_movements_updated_at ON public.cash_movements;
CREATE TRIGGER set_cash_movements_updated_at
  BEFORE UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Cash movements viewable by store members" ON public.cash_movements;
CREATE POLICY "Cash movements viewable by store members"
    ON public.cash_movements FOR SELECT TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Cash movements manageable by store management" ON public.cash_movements;
CREATE POLICY "Cash movements manageable by store management"
    ON public.cash_movements FOR ALL TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    bank_name TEXT NOT NULL,
    account_type TEXT DEFAULT 'Cuenta Corriente',
    account_number TEXT,
    cbu TEXT,
    balance NUMERIC(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bank accounts viewable by store members" ON public.bank_accounts;
CREATE POLICY "Bank accounts viewable by store members"
    ON public.bank_accounts FOR SELECT TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()) AND is_active = true);

DROP POLICY IF EXISTS "Bank accounts manageable by store admins" ON public.bank_accounts;
CREATE POLICY "Bank accounts manageable by store admins"
    ON public.bank_accounts FOR ALL TO authenticated
    USING (store_id IN (SELECT public.get_my_admin_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_admin_store_ids()));


CREATE TABLE IF NOT EXISTS public.cash_flows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    flow_type TEXT NOT NULL,
    category TEXT,
    concept TEXT,
    amount NUMERIC(12,2) DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cash_flows ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_cash_flows_updated_at ON public.cash_flows;
CREATE TRIGGER set_cash_flows_updated_at
  BEFORE UPDATE ON public.cash_flows
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Cash flows viewable by store members" ON public.cash_flows;
CREATE POLICY "Cash flows viewable by store members"
    ON public.cash_flows FOR SELECT TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Cash flows manageable by store management" ON public.cash_flows;
CREATE POLICY "Cash flows manageable by store management"
    ON public.cash_flows FOR ALL TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

CREATE TABLE IF NOT EXISTS public.purchase_vouchers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    customer_name TEXT,
    amount NUMERIC(12,2) DEFAULT 0 CHECK (amount >= 0),
    status public.purchase_voucher_status_enum DEFAULT 'Activo',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, code)
);
ALTER TABLE public.purchase_vouchers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_purchase_vouchers_updated_at ON public.purchase_vouchers;
CREATE TRIGGER set_purchase_vouchers_updated_at
  BEFORE UPDATE ON public.purchase_vouchers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Purchase vouchers viewable by store members" ON public.purchase_vouchers;
CREATE POLICY "Purchase vouchers viewable by store members"
    ON public.purchase_vouchers FOR SELECT TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Purchase vouchers manageable by store management" ON public.purchase_vouchers;
CREATE POLICY "Purchase vouchers manageable by store management"
    ON public.purchase_vouchers FOR ALL TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

CREATE TABLE IF NOT EXISTS public.discount_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    min_amount NUMERIC(12,2) DEFAULT 0 CHECK (min_amount >= 0),
    applies_to TEXT DEFAULT 'Todas las categorías',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.discount_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Discount rules viewable by store members" ON public.discount_rules;
CREATE POLICY "Discount rules viewable by store members"
    ON public.discount_rules FOR SELECT TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Discount rules manageable by store admins" ON public.discount_rules;
CREATE POLICY "Discount rules manageable by store admins"
    ON public.discount_rules FOR ALL TO authenticated
    USING (store_id IN (SELECT public.get_my_admin_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_admin_store_ids()));

CREATE TABLE IF NOT EXISTS public.custom_properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    field_name TEXT NOT NULL,
    field_type TEXT DEFAULT 'Texto',
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.custom_properties ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_custom_properties_updated_at ON public.custom_properties;
CREATE TRIGGER set_custom_properties_updated_at
  BEFORE UPDATE ON public.custom_properties
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Custom properties viewable by store members" ON public.custom_properties;
CREATE POLICY "Custom properties viewable by store members"
    ON public.custom_properties FOR SELECT TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Custom properties manageable by store admins" ON public.custom_properties;
CREATE POLICY "Custom properties manageable by store admins"
    ON public.custom_properties FOR ALL TO authenticated
    USING (store_id IN (SELECT public.get_my_admin_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_admin_store_ids()));


-- ------------------------------------------
-- 13.5 POS SALES, ITEMS & CASH CLOSURES (Store Multi-Tenant)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ticket_number TEXT,
    cashier_email TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    invoice_type TEXT,
    price_list_id UUID REFERENCES public.price_lists(id) ON DELETE SET NULL,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    discount_amount NUMERIC(12,2) DEFAULT 0.00 CHECK (discount_amount >= 0),
    payment_method public.payment_method_enum DEFAULT 'Efectivo',
    card_tariff_id UUID REFERENCES public.card_tariffs(id) ON DELETE SET NULL,
    voucher_id UUID REFERENCES public.purchase_vouchers(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Completada',
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_sales_updated_at ON public.sales;
CREATE TRIGGER set_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Sales viewable by store members" ON public.sales;
CREATE POLICY "Sales viewable by store members"
    ON public.sales FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Sales manageable by store members" ON public.sales;
CREATE POLICY "Sales manageable by store members"
    ON public.sales FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_store_ids()));

CREATE TABLE IF NOT EXISTS public.sales_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    article_code TEXT NOT NULL,
    article_description TEXT NOT NULL,
    qty NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (qty > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    cost_price NUMERIC(10,2) DEFAULT 0 CHECK (cost_price >= 0),
    discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales items viewable by store members" ON public.sales_items;
CREATE POLICY "Sales items viewable by store members"
    ON public.sales_items FOR SELECT
    TO authenticated
    USING (
      sale_id IN (
        SELECT s.id FROM public.sales s
        WHERE s.store_id IN (SELECT public.get_my_store_ids())
      )
    );

DROP POLICY IF EXISTS "Sales items manageable by store members" ON public.sales_items;
CREATE POLICY "Sales items manageable by store members"
    ON public.sales_items FOR ALL
    TO authenticated
    USING (
      sale_id IN (
        SELECT s.id FROM public.sales s
        WHERE s.store_id IN (SELECT public.get_my_store_ids())
      )
    )
    WITH CHECK (
      sale_id IN (
        SELECT s.id FROM public.sales s
        WHERE s.store_id IN (SELECT public.get_my_store_ids())
      )
    );

CREATE TABLE IF NOT EXISTS public.sales_closures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    opening_amount NUMERIC(12,2) DEFAULT 0.00,
    closing_amount NUMERIC(12,2) DEFAULT 0.00,
    total_sales NUMERIC(12,2) DEFAULT 0.00,
    total_transactions INT DEFAULT 0,
    difference NUMERIC(12,2) DEFAULT 0.00,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sales_closures ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_sales_closures_updated_at ON public.sales_closures;
CREATE TRIGGER set_sales_closures_updated_at
  BEFORE UPDATE ON public.sales_closures
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP POLICY IF EXISTS "Sales closures viewable by store members" ON public.sales_closures;
CREATE POLICY "Sales closures viewable by store members"
    ON public.sales_closures FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

DROP POLICY IF EXISTS "Sales closures manageable by store management" ON public.sales_closures;
CREATE POLICY "Sales closures manageable by store management"
    ON public.sales_closures FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_management_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_management_store_ids()));

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    keys JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Push subscriptions manageable by store members" ON public.push_subscriptions;
CREATE POLICY "Push subscriptions manageable by store members"
    ON public.push_subscriptions FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_store_ids()));

CREATE TABLE IF NOT EXISTS public.label_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    width_mm NUMERIC(6,2) DEFAULT 50,
    height_mm NUMERIC(6,2) DEFAULT 30,
    elements JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Label templates manageable by store members" ON public.label_templates;
CREATE POLICY "Label templates manageable by store members"
    ON public.label_templates FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_store_ids()));

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications viewable by store members" ON public.notifications;
CREATE POLICY "Notifications viewable by store members"
    ON public.notifications FOR ALL
    TO authenticated
    USING (store_id IS NULL OR store_id IN (SELECT public.get_my_store_ids()))
    WITH CHECK (store_id IS NULL OR store_id IN (SELECT public.get_my_store_ids()));

CREATE TABLE IF NOT EXISTS public.currency_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
    currency_code TEXT NOT NULL,
    currency_name TEXT NOT NULL,
    rate_to_ars NUMERIC(12,4) NOT NULL DEFAULT 1.0,
    source TEXT DEFAULT 'API DolarApi / BCRA',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, currency_code)
);

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Currency rates manageable by store members" ON public.currency_rates;
CREATE POLICY "Currency rates manageable by store members"
    ON public.currency_rates FOR ALL
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()))
    WITH CHECK (store_id IN (SELECT public.get_my_store_ids()));

-- ------------------------------------------
-- 13.5. HISTORICAL ARCHIVE TABLES & AUTOMATED PROCEDURE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_archive (
    id UUID PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    register_id UUID,
    cashier_id UUID,
    price_list_id UUID,
    total_amount NUMERIC(12,2),
    discount_amount NUMERIC(12,2),
    payment_method public.payment_method_enum,
    card_tariff_id UUID,
    voucher_id UUID,
    status TEXT,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sales_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales archive viewable by store members" ON public.sales_archive;
CREATE POLICY "Sales archive viewable by store members"
    ON public.sales_archive FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

CREATE TABLE IF NOT EXISTS public.sales_items_archive (
    id UUID PRIMARY KEY,
    sale_id UUID,
    article_id UUID,
    article_code TEXT,
    article_description TEXT,
    qty NUMERIC(10,2),
    unit_price NUMERIC(10,2),
    discount_percent NUMERIC(5,2),
    total_price NUMERIC(12,2),
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sales_items_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sales items archive viewable by store members" ON public.sales_items_archive;
CREATE POLICY "Sales items archive viewable by store members"
    ON public.sales_items_archive FOR SELECT
    TO authenticated
    USING (
      sale_id IN (
        SELECT sa.id FROM public.sales_archive sa
        WHERE sa.store_id IN (SELECT public.get_my_store_ids())
      )
    );

CREATE TABLE IF NOT EXISTS public.stock_movements_archive (
    id UUID PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    movement_type public.stock_movement_enum,
    observations TEXT,
    total_units NUMERIC(10,2),
    created_by UUID,
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_movements_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stock movements archive viewable by store members" ON public.stock_movements_archive;
CREATE POLICY "Stock movements archive viewable by store members"
    ON public.stock_movements_archive FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

CREATE TABLE IF NOT EXISTS public.stock_movement_items_archive (
    id UUID PRIMARY KEY,
    movement_id UUID,
    article_id UUID,
    article_code TEXT,
    article_description TEXT,
    qty NUMERIC(10,2),
    unit_price NUMERIC(10,2),
    total_price NUMERIC(12,2),
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_movement_items_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stock movement items archive viewable by store members" ON public.stock_movement_items_archive;
CREATE POLICY "Stock movement items archive viewable by store members"
    ON public.stock_movement_items_archive FOR SELECT
    TO authenticated
    USING (
      movement_id IN (
        SELECT sma.id FROM public.stock_movements_archive sma
        WHERE sma.store_id IN (SELECT public.get_my_store_ids())
      )
    );

CREATE TABLE IF NOT EXISTS public.price_audit_logs_archive (
    id UUID PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    article_id UUID,
    article_code TEXT,
    article_description TEXT,
    price_list_name TEXT,
    old_price NUMERIC(12,2),
    new_price NUMERIC(12,2),
    reason TEXT,
    user_email TEXT,
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.price_audit_logs_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Price audit logs archive viewable by store members" ON public.price_audit_logs_archive;
CREATE POLICY "Price audit logs archive viewable by store members"
    ON public.price_audit_logs_archive FOR SELECT
    TO authenticated
    USING (store_id IN (SELECT public.get_my_store_ids()));

-- Procedure: Archive old records > p_months
CREATE OR REPLACE FUNCTION public.archive_old_records(
  p_months INT DEFAULT 24
)
RETURNS JSONB AS $$
DECLARE
  _cutoff TIMESTAMPTZ := NOW() - (p_months || ' months')::INTERVAL;
  _sales_count INT := 0;
  _movements_count INT := 0;
  _audit_count INT := 0;
BEGIN
  -- 1. Archive Sales & Items
  WITH old_sales AS (
    SELECT * FROM public.sales WHERE created_at < _cutoff
  ),
  ins_sales AS (
    INSERT INTO public.sales_archive (id, store_id, register_id, cashier_id, price_list_id, total_amount, discount_amount, payment_method, card_tariff_id, voucher_id, status, synced_at, created_at, updated_at)
    SELECT id, store_id, register_id, cashier_id, price_list_id, total_amount, discount_amount, payment_method, card_tariff_id, voucher_id, status, synced_at, created_at, updated_at
    FROM old_sales
    ON CONFLICT (id) DO NOTHING
  ),
  ins_items AS (
    INSERT INTO public.sales_items_archive (id, sale_id, article_id, article_code, article_description, qty, unit_price, discount_percent, total_price, created_at)
    SELECT i.id, i.sale_id, i.article_id, i.article_code, i.article_description, i.qty, i.unit_price, i.discount_percent, i.total_price, i.created_at
    FROM public.sales_items i JOIN old_sales s ON i.sale_id = s.id
    ON CONFLICT (id) DO NOTHING
  ),
  del_sales AS (
    DELETE FROM public.sales WHERE created_at < _cutoff RETURNING id
  )
  SELECT COUNT(*) INTO _sales_count FROM del_sales;

  -- 2. Archive Stock Movements
  WITH old_movements AS (
    SELECT * FROM public.stock_movements WHERE created_at < _cutoff
  ),
  ins_movs AS (
    INSERT INTO public.stock_movements_archive (id, store_id, movement_type, observations, total_units, created_by, created_at)
    SELECT id, store_id, movement_type, observations, total_units, created_by, created_at
    FROM old_movements
    ON CONFLICT (id) DO NOTHING
  ),
  ins_mov_items AS (
    INSERT INTO public.stock_movement_items_archive (id, movement_id, article_id, article_code, article_description, qty, unit_price, total_price, created_at)
    SELECT mi.id, mi.movement_id, mi.article_id, mi.article_code, mi.article_description, mi.qty, mi.unit_price, mi.total_price, mi.created_at
    FROM public.stock_movement_items mi JOIN old_movements m ON mi.movement_id = m.id
    ON CONFLICT (id) DO NOTHING
  ),
  del_movs AS (
    DELETE FROM public.stock_movements WHERE created_at < _cutoff RETURNING id
  )
  SELECT COUNT(*) INTO _movements_count FROM del_movs;

  -- 3. Archive Price Audit Logs
  WITH old_audit AS (
    SELECT * FROM public.price_audit_logs WHERE created_at < _cutoff
  ),
  ins_audit AS (
    INSERT INTO public.price_audit_logs_archive (id, store_id, article_id, article_code, article_description, price_list_name, old_price, new_price, reason, user_email, created_at)
    SELECT id, store_id, article_id, article_code, article_description, price_list_name, old_price, new_price, reason, user_email, created_at
    FROM old_audit
    ON CONFLICT (id) DO NOTHING
  ),
  del_audit AS (
    DELETE FROM public.price_audit_logs WHERE created_at < _cutoff RETURNING id
  )
  SELECT COUNT(*) INTO _audit_count FROM del_audit;

  RETURN jsonb_build_object(
    'status', 'success',
    'cutoff_date', _cutoff,
    'archived_sales', _sales_count,
    'archived_stock_movements', _movements_count,
    'archived_price_audit_logs', _audit_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- ------------------------------------------
-- 14. PERFORMANCE OPTIMIZATION INDEXES
-- ------------------------------------------
CREATE INDEX IF NOT EXISTS idx_store_members_user_active ON public.store_members(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_store_members_user_role_active ON public.store_members(user_id, role, is_active);
CREATE INDEX IF NOT EXISTS idx_store_members_store_id ON public.store_members(store_id);

CREATE INDEX IF NOT EXISTS idx_articles_store_id ON public.articles(store_id);
CREATE INDEX IF NOT EXISTS idx_articles_code ON public.articles(code);
CREATE INDEX IF NOT EXISTS idx_articles_barcode ON public.articles(store_id, barcode) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_price_lists_store_id ON public.price_lists(store_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_list_id ON public.price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_article_id ON public.price_list_items(article_id);

CREATE INDEX IF NOT EXISTS idx_cash_registers_store_id ON public.cash_registers(store_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_store_id ON public.stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement_id ON public.stock_movement_items(movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_article_id ON public.stock_movement_items(article_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_store_id ON public.suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_store_supplier ON public.supplier_invoices(store_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_store_supplier ON public.supplier_payments(store_id, supplier_id);

CREATE INDEX IF NOT EXISTS idx_customers_store_id ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers(store_id, code);
CREATE INDEX IF NOT EXISTS idx_customers_fts ON public.customers 
USING gin(to_tsvector('spanish', name || ' ' || COALESCE(cuit, '') || ' ' || code));
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);

CREATE INDEX IF NOT EXISTS idx_notifications_store_user ON public.notifications(store_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(store_id, user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_audit_logs_store_id ON public.price_audit_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_price_audit_logs_user_id ON public.price_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_store_user ON public.user_favorites(store_id, user_id);

CREATE INDEX IF NOT EXISTS idx_card_tariffs_store_id ON public.card_tariffs(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_store_id ON public.cash_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_store_id ON public.bank_accounts(store_id);
CREATE INDEX IF NOT EXISTS idx_currency_rates_store_id ON public.currency_rates(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_store_id ON public.cash_flows(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_vouchers_store_id ON public.purchase_vouchers(store_id);
CREATE INDEX IF NOT EXISTS idx_discount_rules_store_id ON public.discount_rules(store_id);
CREATE INDEX IF NOT EXISTS idx_custom_properties_store_id ON public.custom_properties(store_id);

CREATE INDEX IF NOT EXISTS idx_sales_store_id ON public.sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_register_id ON public.sales(register_id);
CREATE INDEX IF NOT EXISTS idx_sales_ticket_number ON public.sales(store_id, ticket_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id ON public.sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_article_id ON public.sales_items(article_id);

CREATE INDEX IF NOT EXISTS idx_sales_closures_store_id ON public.sales_closures(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_closures_register_id ON public.sales_closures(register_id);

-- Full-text search sobre articles
CREATE INDEX IF NOT EXISTS idx_articles_fts ON public.articles 
USING gin(to_tsvector('spanish', description || ' ' || code));

-- Para suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_fts ON public.suppliers 
USING gin(to_tsvector('spanish', name || ' ' || COALESCE(cuit, '')));


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
((SELECT id FROM m), 'Cambio Rápido', 'cambio-rapido', 'RefreshCw', 4),
((SELECT id FROM m), 'Recomendaciones IA', 'ai-precios', 'Sparkles', 5);

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
((SELECT id FROM m), 'Admin Cta Cte', 'admin-cta-cte', 'Settings', 4),
((SELECT id FROM m), 'Gestión de Clientes', 'gestion-clientes', 'UserCheck', 5);

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
((SELECT id FROM m), 'Configuración BackEnd', 'configuracion-backend', 'Database', 5),
((SELECT id FROM m), 'Design System', 'design-system', 'Sparkles', 6);

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

-- Seed System Welcome Notifications
INSERT INTO public.notifications (store_id, title, message, type, is_read) VALUES
('11111111-1111-1111-1111-111111111111', '¡Bienvenido a PickingUp! Administración', 'Tu comercio PICKING & DELIVERING UP! S.A. está activo con arquitectura aislada.', 'success', false),
('11111111-1111-1111-1111-111111111111', 'Aislamiento Multi-Tenant Activo', 'Tus datos de precios, cajas y productos son 100% privados e independientes.', 'info', false)
ON CONFLICT DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;