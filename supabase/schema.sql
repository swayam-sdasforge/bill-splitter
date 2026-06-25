-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Tables

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  upi_id TEXT,
  qr_code_url TEXT,
  doubloons INT DEFAULT 0,
  unlocked_avatars TEXT[] DEFAULT '{"🏴‍☠️"}',
  active_avatar TEXT DEFAULT '🏴‍☠️',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.personal_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT CHECK (category IN ('Food', 'Transport', 'Entertainment', 'Shopping', 'Utilities', 'Health', 'Other')),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shared_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_name TEXT NOT NULL,
  budget DECIMAL(10,2),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.shared_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.shared_groups(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  photo_url TEXT,
  split_type TEXT DEFAULT 'equal',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expense_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES public.group_expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  guest_id UUID, -- References voyage_guests(id)
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR 
    (user_id IS NULL AND guest_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES public.shared_groups(id) ON DELETE CASCADE, -- null if personal
  paid_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT,
  frequency TEXT CHECK (frequency IN ('weekly', 'monthly')),
  next_due_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.shared_groups(id) ON DELETE CASCADE,
  payer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  payer_guest_id UUID,
  payee_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  payee_guest_id UUID,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CHECK (
    (payee_id IS NOT NULL AND payee_guest_id IS NULL) OR 
    (payee_id IS NULL AND payee_guest_id IS NOT NULL)
  ),
  CHECK (
    (payer_id IS NOT NULL AND payer_guest_id IS NULL) OR 
    (payer_id IS NULL AND payer_guest_id IS NOT NULL)
  )
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- users policies
DROP POLICY IF EXISTS "Users can select their own profile" ON public.users;
CREATE POLICY "Users can select profiles" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- personal_expenses policies
DROP POLICY IF EXISTS "Users can select their own expenses" ON public.personal_expenses;
CREATE POLICY "Users can select their own expenses" ON public.personal_expenses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.personal_expenses;
CREATE POLICY "Users can insert their own expenses" ON public.personal_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own expenses" ON public.personal_expenses;
CREATE POLICY "Users can update their own expenses" ON public.personal_expenses FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.personal_expenses;
CREATE POLICY "Users can delete their own expenses" ON public.personal_expenses FOR DELETE USING (auth.uid() = user_id);

-- shared_groups policies
DROP POLICY IF EXISTS "Users can select groups they created or joined" ON public.shared_groups;
CREATE POLICY "Users can select groups they created or joined" ON public.shared_groups FOR SELECT 
  USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.group_members WHERE group_id = public.shared_groups.id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert groups" ON public.shared_groups;
CREATE POLICY "Users can insert groups" ON public.shared_groups FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update groups they created" ON public.shared_groups;
CREATE POLICY "Users can update groups they created" ON public.shared_groups FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete groups they created" ON public.shared_groups;
CREATE POLICY "Users can delete groups they created" ON public.shared_groups FOR DELETE USING (auth.uid() = created_by);

-- group_members policies
DROP POLICY IF EXISTS "Users can select members of their groups" ON public.group_members;
CREATE POLICY "Users can select members of their groups" ON public.group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert themselves into a group" ON public.group_members;
CREATE POLICY "Users can insert themselves into a group" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete themselves from a group" ON public.group_members;
CREATE POLICY "Users can delete themselves from a group" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- group_expenses policies
DROP POLICY IF EXISTS "Users can select expenses of their groups" ON public.group_expenses;
CREATE POLICY "Users can select expenses of their groups" ON public.group_expenses FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = public.group_expenses.group_id AND gm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert expenses in their groups" ON public.group_expenses;
CREATE POLICY "Users can insert expenses in their groups" ON public.group_expenses FOR INSERT 
  WITH CHECK (auth.uid() = paid_by AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = public.group_expenses.group_id AND gm.user_id = auth.uid()));

-- recurring_expenses policies
DROP POLICY IF EXISTS "Users can select their recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can select their recurring expenses" ON public.recurring_expenses FOR SELECT USING (auth.uid() = paid_by);

DROP POLICY IF EXISTS "Users can insert their recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can insert their recurring expenses" ON public.recurring_expenses FOR INSERT WITH CHECK (auth.uid() = paid_by);

DROP POLICY IF EXISTS "Users can update their recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can update their recurring expenses" ON public.recurring_expenses FOR UPDATE USING (auth.uid() = paid_by);

DROP POLICY IF EXISTS "Users can delete their recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can delete their recurring expenses" ON public.recurring_expenses FOR DELETE USING (auth.uid() = paid_by);

ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select expense splits for their groups" ON public.expense_splits;
CREATE POLICY "Users can select expense splits for their groups" ON public.expense_splits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.group_expenses ge
    JOIN public.group_members gm ON gm.group_id = ge.group_id
    WHERE ge.id = public.expense_splits.expense_id AND gm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert expense splits in their groups" ON public.expense_splits;
CREATE POLICY "Users can insert expense splits in their groups" ON public.expense_splits FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_expenses ge
    JOIN public.group_members gm ON gm.group_id = ge.group_id
    WHERE ge.id = public.expense_splits.expense_id AND gm.user_id = auth.uid()
  )
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select payments in their groups" ON public.payments;
CREATE POLICY "Users can select payments in their groups" ON public.payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = public.payments.group_id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert payments in their groups" ON public.payments;
CREATE POLICY "Users can insert payments in their groups" ON public.payments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = public.payments.group_id AND user_id = auth.uid()
  )
);
