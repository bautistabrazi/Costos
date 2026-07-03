create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  description text not null,
  category text not null,
  payment_method text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.card_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  purchase_date date not null,
  purchase text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  installments integer not null check (installments > 0),
  paid_installments integer not null default 0 check (paid_installments >= 0),
  first_due_month text not null,
  is_fixed_expense boolean not null default false,
  fixed_expense_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint paid_installments_lte_installments check (paid_installments <= installments)
);

alter table public.card_purchases
  add column if not exists is_fixed_expense boolean not null default false;

alter table public.card_purchases
  add column if not exists fixed_expense_active boolean not null default true;

alter table public.cards enable row level security;
alter table public.daily_expenses enable row level security;
alter table public.card_purchases enable row level security;

drop policy if exists "Users can read own cards" on public.cards;
drop policy if exists "Users can insert own cards" on public.cards;
drop policy if exists "Users can update own cards" on public.cards;
drop policy if exists "Users can delete own cards" on public.cards;
drop policy if exists "Users can read own daily expenses" on public.daily_expenses;
drop policy if exists "Users can insert own daily expenses" on public.daily_expenses;
drop policy if exists "Users can update own daily expenses" on public.daily_expenses;
drop policy if exists "Users can delete own daily expenses" on public.daily_expenses;
drop policy if exists "Users can read own card purchases" on public.card_purchases;
drop policy if exists "Users can insert own card purchases" on public.card_purchases;
drop policy if exists "Users can update own card purchases" on public.card_purchases;
drop policy if exists "Users can delete own card purchases" on public.card_purchases;

create policy "Users can read own cards"
  on public.cards for select
  using (auth.uid() = user_id);

create policy "Users can insert own cards"
  on public.cards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cards"
  on public.cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own cards"
  on public.cards for delete
  using (auth.uid() = user_id);

create policy "Users can read own daily expenses"
  on public.daily_expenses for select
  using (auth.uid() = user_id);

create policy "Users can insert own daily expenses"
  on public.daily_expenses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own daily expenses"
  on public.daily_expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own daily expenses"
  on public.daily_expenses for delete
  using (auth.uid() = user_id);

create policy "Users can read own card purchases"
  on public.card_purchases for select
  using (auth.uid() = user_id);

create policy "Users can insert own card purchases"
  on public.card_purchases for insert
  with check (auth.uid() = user_id);

create policy "Users can update own card purchases"
  on public.card_purchases for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own card purchases"
  on public.card_purchases for delete
  using (auth.uid() = user_id);
