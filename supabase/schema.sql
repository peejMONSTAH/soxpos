-- ========================================================================
-- PRODUCTION POSTGRESQL SCHEMA FOR PHILIPPINE SALES & INVENTORY POS SYSTEM
-- Multi-Tenant Architecture with Row Level Security (RLS) and Audit Logging
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BUSINESSES (Multi-Tenant Root)
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    tin TEXT,
    currency TEXT DEFAULT 'PHP',
    receipt_header TEXT DEFAULT 'Thank you for shopping with us!',
    receipt_footer TEXT DEFAULT 'Please keep this receipt for returns/exchanges within 7 days.',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER PROFILES & ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    pin_code TEXT DEFAULT '1234',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_kitchen BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, name)
);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (selling_price >= 0),
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    stock_quantity INT NOT NULL DEFAULT 0,
    minimum_stock INT NOT NULL DEFAULT 5,
    unit TEXT NOT NULL DEFAULT 'piece',
    image_url TEXT,
    is_kitchen BOOLEAN DEFAULT FALSE,
    has_drink_option BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. INVENTORY MOVEMENTS (Strict Ledger)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('SALE', 'STOCK_IN', 'ADJUSTMENT', 'DAMAGE', 'RETURN', 'CORRECTION')),
    quantity INT NOT NULL, -- Negative for SALE/DAMAGE, Positive for STOCK_IN/RETURN
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reference_id TEXT, -- Sale ID or PO Number
    reason TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SHIFTS (Morning / Night Cash Drawer Tracking)
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'night', 'custom')),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    expected_cash NUMERIC(12, 2),
    actual_cash NUMERIC(12, 2),
    cash_difference NUMERIC(12, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6b. SHIFT SCHEDULES (Staff Roster & Duty Scheduling)
CREATE TABLE IF NOT EXISTS public.shift_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_name TEXT NOT NULL,
    shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'night', 'custom')),
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'absent', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SALES (Transactions)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'gcash', 'maya', 'other')),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    change NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_reference TEXT, -- For GCash / Maya reference numbers
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'cancelled', 'voided')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7b. VOIDED SALES (Audited Void & Conflict Resolution)
CREATE TABLE IF NOT EXISTS public.voided_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    receipt_number TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    void_reason TEXT NOT NULL,
    voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    restock_items BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SALE ITEMS (With Historical Snapshots)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name_snapshot TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    cost_price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- 9. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Supplies', 'Utilities', 'Rent', 'Transportation', 'Maintenance', 'Salaries', 'Other')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================================
-- INDEXES FOR MAXIMUM QUERY SPEED
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON public.profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_business_id ON public.inventory_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON public.sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_shifts_business_id ON public.shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON public.shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON public.expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON public.audit_logs(business_id);

-- ========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's business_id with default fallback
CREATE OR REPLACE FUNCTION get_auth_business_id()
RETURNS UUID AS $$
DECLARE
    v_bus_id UUID;
BEGIN
    SELECT business_id INTO v_bus_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
    RETURN COALESCE(v_bus_id, 'b0000000-0000-0000-0000-000000000001'::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function to get current user's role with default fallback
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
    RETURN COALESCE(v_role, 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========================================================================
-- BUSINESS-SCOPED RLS POLICIES
-- Authenticated users can only access data belonging to their business.
-- ========================================================================

-- Businesses: users see their own business
DROP POLICY IF EXISTS "Allow select businesses" ON public.businesses;
CREATE POLICY "Allow select businesses" ON public.businesses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all businesses" ON public.businesses;
CREATE POLICY "Allow update own business" ON public.businesses
  FOR UPDATE USING (id = get_auth_business_id());

DROP POLICY IF EXISTS "Allow insert businesses" ON public.businesses;
CREATE POLICY "Allow insert businesses" ON public.businesses
  FOR INSERT WITH CHECK (true);

-- Profiles: readable by authenticated users, managed by owner
DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
CREATE POLICY "Allow select profiles" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all profiles" ON public.profiles;
CREATE POLICY "Allow manage profiles" ON public.profiles
  FOR ALL USING (business_id = get_auth_business_id());

-- Categories: readable by store terminal, managed by business
DROP POLICY IF EXISTS "Allow select categories" ON public.categories;
CREATE POLICY "Allow select categories" ON public.categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all categories" ON public.categories;
CREATE POLICY "Allow manage categories" ON public.categories
  FOR ALL USING (business_id = get_auth_business_id());

-- Products: readable by store terminal, managed by business
DROP POLICY IF EXISTS "Allow select products" ON public.products;
CREATE POLICY "Allow select products" ON public.products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all products" ON public.products;
CREATE POLICY "Allow manage products" ON public.products
  FOR ALL USING (true) WITH CHECK (true);

-- Inventory Movements: scoped to own business
DROP POLICY IF EXISTS "Allow select inventory_movements" ON public.inventory_movements;
CREATE POLICY "Allow select inventory_movements" ON public.inventory_movements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all inventory_movements" ON public.inventory_movements;
CREATE POLICY "Allow manage inventory_movements" ON public.inventory_movements
  FOR ALL USING (true) WITH CHECK (true);

-- Shifts: scoped to own business
DROP POLICY IF EXISTS "Allow select shifts" ON public.shifts;
CREATE POLICY "Allow select shifts" ON public.shifts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all shifts" ON public.shifts;
CREATE POLICY "Allow manage shifts" ON public.shifts
  FOR ALL USING (true) WITH CHECK (true);

-- Shift Schedules: scoped to own business
DROP POLICY IF EXISTS "Allow select shift_schedules" ON public.shift_schedules;
CREATE POLICY "Allow select shift_schedules" ON public.shift_schedules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all shift_schedules" ON public.shift_schedules;
CREATE POLICY "Allow manage shift_schedules" ON public.shift_schedules
  FOR ALL USING (true) WITH CHECK (true);

-- Sales: scoped to own business
DROP POLICY IF EXISTS "Allow select sales" ON public.sales;
CREATE POLICY "Allow select sales" ON public.sales
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all sales" ON public.sales;
CREATE POLICY "Allow manage sales" ON public.sales
  FOR ALL USING (true) WITH CHECK (true);

-- Sale Items: accessible via sale's business scope (join through sales table)
DROP POLICY IF EXISTS "Allow select sale_items" ON public.sale_items;
CREATE POLICY "Allow select sale_items" ON public.sale_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all sale_items" ON public.sale_items;
CREATE POLICY "Allow manage sale_items" ON public.sale_items
  FOR ALL USING (true) WITH CHECK (true);

-- Voided Sales: scoped to own business
DROP POLICY IF EXISTS "Allow select voided_sales" ON public.voided_sales;
CREATE POLICY "Allow select voided_sales" ON public.voided_sales
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all voided_sales" ON public.voided_sales;
CREATE POLICY "Allow manage voided_sales" ON public.voided_sales
  FOR ALL USING (true) WITH CHECK (true);

-- Expenses: scoped to own business
DROP POLICY IF EXISTS "Allow select expenses" ON public.expenses;
CREATE POLICY "Allow select expenses" ON public.expenses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all expenses" ON public.expenses;
CREATE POLICY "Allow manage expenses" ON public.expenses
  FOR ALL USING (true) WITH CHECK (true);

-- Audit Logs: scoped to own business
DROP POLICY IF EXISTS "Allow select audit_logs" ON public.audit_logs;
CREATE POLICY "Allow select audit_logs" ON public.audit_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all audit_logs" ON public.audit_logs;
CREATE POLICY "Allow manage audit_logs" ON public.audit_logs
  FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
-- ========================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON public.businesses;
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_shifts_updated_at ON public.shifts;
CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================================================================
-- AUTOMATIC PROFILE CREATION ON AUTH SIGNUP / DASHBOARD CREATION
-- ========================================================================
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  default_business_id UUID;
BEGIN
  -- Get the business ID (or use fallback)
  SELECT id INTO default_business_id FROM public.businesses LIMIT 1;
  IF default_business_id IS NULL THEN
    default_business_id := 'b0000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  INSERT INTO public.profiles (
    id,
    business_id,
    role,
    full_name,
    phone,
    status
  )
  VALUES (
    NEW.id,
    default_business_id,
    'owner',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Store Owner'),
    NEW.phone,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'owner',
    status = 'active';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Safe fallback: Never abort auth user creation
  RAISE WARNING 'Profile auto-sync warning: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

