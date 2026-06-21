-- Launch V1.1: admin-only manual finance tracker (income / expense).

CREATE TABLE IF NOT EXISTS public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'EGP',
  category text NOT NULL,
  subcategory text,
  note text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  custom_item_name text,
  supplier_note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_entries_entry_date
  ON public.finance_entries (entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_finance_entries_type
  ON public.finance_entries (type);

CREATE INDEX IF NOT EXISTS idx_finance_entries_category
  ON public.finance_entries (category);

CREATE INDEX IF NOT EXISTS idx_finance_entries_product_id
  ON public.finance_entries (product_id)
  WHERE product_id IS NOT NULL;

COMMENT ON TABLE public.finance_entries IS
  'Manual admin finance ledger; not auto-synced to orders in V1.';
