-- Faro · esquema inicial para Supabase/PostgreSQL
create extension if not exists pgcrypto;

create type public.payment_method as enum ('cash','credit_card','debit_card','transfer','mercado_pago','wallet','other');
create type public.payment_status as enum ('pending','paid','overdue','cancelled');
create type public.budget_scope as enum ('general','category','payment_method');
create type public.recurrence_frequency as enum ('weekly','biweekly','monthly','bimonthly','quarterly','semiannual','annual');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default '',
  main_currency char(3) not null default 'ARS',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  date_format text not null default 'dd/MM/yyyy',
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = user_id)
);
create table public.accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80), type text not null default 'other',
  currency char(3) not null default 'ARS', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80), issuer text not null check (char_length(issuer) between 1 and 100),
  brand text not null, color char(7) not null default '#5658d4',
  total_limit numeric(14,2) not null default 0 check (total_limit >= 0), available_limit numeric(14,2) check (available_limit >= 0),
  currency char(3) not null default 'ARS', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,name), unique(id,user_id)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60), icon text not null default 'Shapes', color char(7) not null default '#64748b',
  monthly_budget numeric(14,2) check (monthly_budget is null or monthly_budget >= 0), sort_order integer not null default 100,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,name), unique(id,user_id)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null, account_id uuid,
  credit_card_id uuid, category_id uuid,
  description text not null check (char_length(description) between 1 and 120), amount numeric(14,2) not null check (amount > 0),
  purchase_date date not null, payment_method public.payment_method not null, currency char(3) not null default 'ARS',
  installment_count smallint not null default 1 check (installment_count between 1 and 120),
  current_installment smallint not null default 1 check (current_installment between 1 and installment_count),
  first_due_date date, merchant text check (merchant is null or char_length(merchant) <= 120), notes text,
  is_recurring boolean not null default false, recurrence_frequency public.recurrence_frequency,
  statement_period char(7) check (statement_period is null or statement_period ~ '^[0-9]{4}-[0-9]{2}$'),
  statement_overridden boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,client_id), unique(id,user_id),
  foreign key(account_id,user_id) references public.accounts(id,user_id) on delete set null (account_id),
  foreign key(credit_card_id,user_id) references public.credit_cards(id,user_id) on delete restrict,
  foreign key(category_id,user_id) references public.categories(id,user_id) on delete set null (category_id),
  check ((payment_method='credit_card' and credit_card_id is not null) or (payment_method<>'credit_card' and credit_card_id is null)),
  check (installment_count=1 or first_due_date is not null),
  check (payment_method<>'credit_card' or first_due_date is not null),
  check ((is_recurring and recurrence_frequency is not null) or not is_recurring)
);
create table public.installment_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null, credit_card_id uuid not null,
  total_amount numeric(14,2) not null check (total_amount>0), installment_count smallint not null check (installment_count between 2 and 120),
  fixed_installment_amount numeric(14,2) check (fixed_installment_amount is null or fixed_installment_amount>0),
  first_due_date date not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(transaction_id), unique(id,user_id),
  foreign key(transaction_id,user_id) references public.transactions(id,user_id) on delete cascade,
  foreign key(credit_card_id,user_id) references public.credit_cards(id,user_id) on delete restrict
);
create table public.installments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null, credit_card_id uuid not null,
  number smallint not null check (number>0), amount numeric(14,2) not null check (amount>0), due_date date not null,
  statement_period char(7) not null check (statement_period ~ '^[0-9]{4}-[0-9]{2}$'),
  status public.payment_status not null default 'pending', paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(plan_id,number),
  foreign key(plan_id,user_id) references public.installment_plans(id,user_id) on delete cascade,
  foreign key(credit_card_id,user_id) references public.credit_cards(id,user_id) on delete restrict
);
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  description text not null, amount numeric(14,2) not null check(amount>0), category_id uuid,
  payment_method public.payment_method not null, credit_card_id uuid,
  currency char(3) not null default 'ARS', frequency public.recurrence_frequency not null, next_due_date date not null,
  end_date date, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,user_id), foreign key(category_id,user_id) references public.categories(id,user_id) on delete set null (category_id),
  foreign key(credit_card_id,user_id) references public.credit_cards(id,user_id) on delete restrict
);
create table public.budgets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  month char(7) not null check(month ~ '^[0-9]{4}-[0-9]{2}$'), scope public.budget_scope not null,
  category_id uuid, payment_method public.payment_method,
  amount numeric(14,2) not null check(amount>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((scope='general' and category_id is null and payment_method is null) or (scope='category' and category_id is not null and payment_method is null) or (scope='payment_method' and category_id is null and payment_method is not null)),
  foreign key(category_id,user_id) references public.categories(id,user_id) on delete cascade
);
create unique index budgets_unique_scope on public.budgets(user_id,month,scope,coalesce(category_id,'00000000-0000-0000-0000-000000000000'),coalesce(payment_method,'cash'::public.payment_method));
create table public.scheduled_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recurring_expense_id uuid, transaction_id uuid,
  description text not null, payment_type text not null default 'scheduled', amount numeric(14,2) not null check(amount>0),
  currency char(3) not null default 'ARS', due_date date not null, status public.payment_status not null default 'pending',
  paid_at timestamptz, client_id uuid default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,client_id), unique(recurring_expense_id,due_date), unique(transaction_id),
  foreign key(recurring_expense_id,user_id) references public.recurring_expenses(id,user_id) on delete cascade,
  foreign key(transaction_id,user_id) references public.transactions(id,user_id) on delete cascade
);
create table public.tags (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 40), color char(7) not null default '#64748b',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,name), unique(id,user_id)
);
create table public.transaction_tags (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null, tag_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(transaction_id,tag_id),
  foreign key(transaction_id,user_id) references public.transactions(id,user_id) on delete cascade,
  foreign key(tag_id,user_id) references public.tags(id,user_id) on delete cascade
);

create index transactions_user_date_idx on public.transactions(user_id,purchase_date desc);
create index transactions_card_date_idx on public.transactions(credit_card_id,purchase_date desc);
create index installments_user_due_idx on public.installments(user_id,due_date,status);
create index scheduled_user_due_idx on public.scheduled_payments(user_id,due_date,status);
create index recurring_user_next_idx on public.recurring_expenses(user_id,next_due_date) where active;

create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','accounts','credit_cards','categories','transactions','installment_plans','installments','recurring_expenses','budgets','scheduled_payments','tags','transaction_tags'] loop execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t); end loop; end $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb; begin
 insert into public.profiles(id,user_id,full_name) values(new.id,new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
 for item in select * from jsonb_array_elements('[["Supermercado","ShoppingCart","#ef7b45"],["Comida","Utensils","#f59e0b"],["Transporte","Bus","#3b82f6"],["Combustible","Fuel","#eab308"],["Vivienda","House","#8b5cf6"],["Servicios","Zap","#06b6d4"],["Suscripciones","Repeat2","#ec4899"],["Ropa","Shirt","#a855f7"],["Salud","HeartPulse","#ef4444"],["Educación","GraduationCap","#14b8a6"],["Entretenimiento","Clapperboard","#f97316"],["Tecnología","Laptop","#6366f1"],["Impuestos","Landmark","#64748b"],["Mascotas","PawPrint","#84cc16"],["Regalos","Gift","#d946ef"],["Otros","Shapes","#94a3b8"]]'::jsonb)
 loop insert into public.categories(user_id,name,icon,color,sort_order) values(new.id,item->>0,item->>1,item->>2,100); end loop; return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.validate_owned_references() returns trigger language plpgsql as $$
begin
 if new.credit_card_id is not null and not exists(select 1 from public.credit_cards where id=new.credit_card_id and user_id=new.user_id) then raise exception 'La tarjeta no pertenece al usuario'; end if;
 if new.category_id is not null and not exists(select 1 from public.categories where id=new.category_id and user_id=new.user_id) then raise exception 'La categoría no pertenece al usuario'; end if;
 if new.account_id is not null and not exists(select 1 from public.accounts where id=new.account_id and user_id=new.user_id) then raise exception 'La cuenta no pertenece al usuario'; end if;
 return new;
end $$;
create trigger validate_transaction_refs before insert or update on public.transactions for each row execute function public.validate_owned_references();

create or replace function public.create_transaction_with_installments(p_payload jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid:=coalesce((p_payload->>'id')::uuid,gen_random_uuid());v_card public.credit_cards;v_plan uuid;v_count int:=coalesce((p_payload->>'installment_count')::int,1);v_total numeric:=(p_payload->>'amount')::numeric;v_base int;v_cents int;v_amount numeric;v_due date;v_step interval;v_tags jsonb;v_tag text;v_tag_id uuid;v_purchase date:=(p_payload->>'purchase_date')::date;v_period date;v_statement char(7);v_overridden boolean:=nullif(p_payload->>'statement_period_override','') is not null;
begin
 if (p_payload->>'user_id')::uuid<>auth.uid() then raise exception 'Usuario inválido'; end if;
 if exists(select 1 from public.transactions where user_id=auth.uid() and client_id=(p_payload->>'client_id')::uuid) then return (select id from public.transactions where user_id=auth.uid() and client_id=(p_payload->>'client_id')::uuid); end if;
 if p_payload->>'credit_card_id' is not null then
  select * into v_card from public.credit_cards where id=(p_payload->>'credit_card_id')::uuid and user_id=auth.uid(); if not found then raise exception 'Tarjeta inválida'; end if;
  v_due:=nullif(p_payload->>'first_due_date','')::date;
  if v_due is null then raise exception 'El vencimiento es obligatorio para consumos con tarjeta'; end if;
  if v_overridden then v_period:=to_date((p_payload->>'statement_period_override')||'-01','YYYY-MM-DD');
  else v_period:=date_trunc('month',v_due)::date; end if;
  v_statement:=to_char(v_period,'YYYY-MM');
 end if;
 insert into public.transactions(id,user_id,client_id,credit_card_id,category_id,description,amount,purchase_date,payment_method,currency,installment_count,current_installment,first_due_date,merchant,notes,is_recurring,recurrence_frequency,statement_period,statement_overridden)
 values(v_id,auth.uid(),(p_payload->>'client_id')::uuid,nullif(p_payload->>'credit_card_id','')::uuid,nullif(p_payload->>'category_id','')::uuid,p_payload->>'description',v_total,v_purchase,(p_payload->>'payment_method')::public.payment_method,coalesce(p_payload->>'currency','ARS'),v_count,coalesce((p_payload->>'current_installment')::int,1),nullif(p_payload->>'first_due_date','')::date,nullif(p_payload->>'merchant',''),nullif(p_payload->>'notes',''),coalesce((p_payload->>'is_recurring')::boolean,false),nullif(p_payload->>'recurrence_frequency','')::public.recurrence_frequency,v_statement,v_overridden);
 if v_count>1 then
  insert into public.installment_plans(user_id,transaction_id,credit_card_id,total_amount,installment_count,fixed_installment_amount,first_due_date) values(auth.uid(),v_id,v_card.id,v_total,v_count,nullif(p_payload->>'fixed_installment_amount','')::numeric,(p_payload->>'first_due_date')::date) returning id into v_plan;
  v_cents:=round(v_total*100);v_base:=floor(v_cents/v_count);
  for i in 1..v_count loop v_due:=((p_payload->>'first_due_date')::date+(i-1)*interval '1 month')::date;v_amount:=coalesce(nullif(p_payload->>'fixed_installment_amount','')::numeric,(v_base+case when i=v_count then v_cents-v_base*v_count else 0 end)/100.0);insert into public.installments(user_id,plan_id,credit_card_id,number,amount,due_date,statement_period) values(auth.uid(),v_plan,v_card.id,i,v_amount,v_due,to_char(v_due,'YYYY-MM'));end loop;
 end if;
 if v_count=1 and v_card.id is not null then insert into public.scheduled_payments(user_id,transaction_id,description,payment_type,amount,currency,due_date,client_id) values(auth.uid(),v_id,'Resumen '||v_card.name,'credit_card',v_total,coalesce(p_payload->>'currency','ARS'),v_due,(p_payload->>'client_id')::uuid); end if;
 if coalesce((p_payload->>'is_recurring')::boolean,false) and not coalesce((p_payload->>'skip_recurring_creation')::boolean,false) then
  v_step:=case (p_payload->>'recurrence_frequency')::public.recurrence_frequency when 'weekly' then interval '1 week' when 'biweekly' then interval '2 weeks' when 'monthly' then interval '1 month' when 'bimonthly' then interval '2 months' when 'quarterly' then interval '3 months' when 'semiannual' then interval '6 months' when 'annual' then interval '1 year' end;
  insert into public.recurring_expenses(user_id,description,amount,category_id,payment_method,credit_card_id,currency,frequency,next_due_date) values(auth.uid(),p_payload->>'description',v_total,nullif(p_payload->>'category_id','')::uuid,(p_payload->>'payment_method')::public.payment_method,nullif(p_payload->>'credit_card_id','')::uuid,coalesce(p_payload->>'currency','ARS'),(p_payload->>'recurrence_frequency')::public.recurrence_frequency,(v_purchase+v_step)::date);
 end if;
 v_tags:=coalesce(p_payload->'tags','[]'::jsonb);for v_tag in select jsonb_array_elements_text(v_tags) loop insert into public.tags(user_id,name) values(auth.uid(),v_tag) on conflict(user_id,name) do update set name=excluded.name returning id into v_tag_id;insert into public.transaction_tags(user_id,transaction_id,tag_id) values(auth.uid(),v_id,v_tag_id) on conflict do nothing;end loop;
 return v_id;
end $$;

create or replace function public.generate_recurring_payments() returns integer language plpgsql security invoker set search_path=public as $$
declare item public.recurring_expenses;v_due date;v_step interval;v_count integer:=0;begin
 for item in select * from public.recurring_expenses where user_id=auth.uid() and active loop
  v_due:=item.next_due_date;
  v_step:=case item.frequency when 'weekly' then interval '1 week' when 'biweekly' then interval '2 weeks' when 'monthly' then interval '1 month' when 'bimonthly' then interval '2 months' when 'quarterly' then interval '3 months' when 'semiannual' then interval '6 months' when 'annual' then interval '1 year' end;
  while v_due<=current_date+interval '12 months' and (item.end_date is null or v_due<=item.end_date) loop
   insert into public.scheduled_payments(user_id,recurring_expense_id,description,payment_type,amount,currency,due_date)
   values(auth.uid(),item.id,item.description,'recurring',item.amount,item.currency,v_due) on conflict(recurring_expense_id,due_date) do nothing;
   if found then v_count:=v_count+1;end if;v_due:=(v_due+v_step)::date;
  end loop;
 end loop;return v_count;
end $$;

create or replace function public.import_user_data(p_payload jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare rec jsonb;v_plan_id uuid;v_transaction_id uuid;begin
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'accounts','[]')) loop insert into public.accounts(id,user_id,name,type,currency,active) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'name',coalesce(rec->>'type','other'),coalesce(rec->>'currency','ARS'),coalesce((rec->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,type=excluded.type,currency=excluded.currency,active=excluded.active,updated_at=now() where accounts.user_id=auth.uid(); end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'credit_cards','[]')) loop insert into public.credit_cards(id,user_id,name,issuer,brand,color,total_limit,available_limit,currency,active) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'name',rec->>'issuer',rec->>'brand',coalesce(rec->>'color','#5658d4'),(rec->>'total_limit')::numeric,nullif(rec->>'available_limit','')::numeric,coalesce(rec->>'currency','ARS'),coalesce((rec->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,issuer=excluded.issuer,brand=excluded.brand,color=excluded.color,total_limit=excluded.total_limit,available_limit=excluded.available_limit,currency=excluded.currency,active=excluded.active,updated_at=now() where credit_cards.user_id=auth.uid(); end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'categories','[]')) loop insert into public.categories(id,user_id,name,icon,color,sort_order) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'name',coalesce(rec->>'icon','Shapes'),coalesce(rec->>'color','#64748b'),coalesce((rec->>'sort_order')::int,100)) on conflict(id) do update set name=excluded.name,color=excluded.color,updated_at=now() where categories.user_id=auth.uid(); end loop;
 -- Los movimientos se importan por la función idempotente para mantener las reglas y cuotas.
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'transactions','[]')) loop perform public.create_transaction_with_installments(rec||jsonb_build_object('user_id',auth.uid(),'client_id',coalesce(rec->>'client_id',gen_random_uuid()::text),'tags','[]'::jsonb,'skip_recurring_creation',true)); end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'installments','[]')) loop
  select (plan->>'transaction_id')::uuid into v_transaction_id from jsonb_array_elements(coalesce(p_payload->'installment_plans','[]')) plan where plan->>'id'=rec->>'plan_id' limit 1;
  select id into v_plan_id from public.installment_plans where transaction_id=v_transaction_id and user_id=auth.uid();
  update public.installments set amount=(rec->>'amount')::numeric,due_date=(rec->>'due_date')::date,statement_period=rec->>'statement_period',status=(rec->>'status')::public.payment_status,paid_at=nullif(rec->>'paid_at','')::timestamptz where plan_id=v_plan_id and number=(rec->>'number')::int and user_id=auth.uid();
 end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'recurring_expenses','[]')) loop insert into public.recurring_expenses(id,user_id,description,amount,category_id,payment_method,credit_card_id,currency,frequency,next_due_date,end_date,active) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'description',(rec->>'amount')::numeric,nullif(rec->>'category_id','')::uuid,(rec->>'payment_method')::public.payment_method,nullif(rec->>'credit_card_id','')::uuid,coalesce(rec->>'currency','ARS'),(rec->>'frequency')::public.recurrence_frequency,(rec->>'next_due_date')::date,nullif(rec->>'end_date','')::date,coalesce((rec->>'active')::boolean,true)) on conflict(id) do update set description=excluded.description,amount=excluded.amount,next_due_date=excluded.next_due_date,end_date=excluded.end_date,active=excluded.active,updated_at=now() where recurring_expenses.user_id=auth.uid(); end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'budgets','[]')) loop insert into public.budgets(id,user_id,month,scope,category_id,payment_method,amount) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'month',(rec->>'scope')::public.budget_scope,nullif(rec->>'category_id','')::uuid,nullif(rec->>'payment_method','')::public.payment_method,(rec->>'amount')::numeric) on conflict(id) do update set month=excluded.month,scope=excluded.scope,category_id=excluded.category_id,payment_method=excluded.payment_method,amount=excluded.amount,updated_at=now() where budgets.user_id=auth.uid(); end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'tags','[]')) loop insert into public.tags(id,user_id,name,color) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'name',coalesce(rec->>'color','#64748b')) on conflict(id) do update set name=excluded.name,color=excluded.color,updated_at=now() where tags.user_id=auth.uid(); end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'transaction_tags','[]')) loop insert into public.transaction_tags(id,user_id,transaction_id,tag_id) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),(rec->>'transaction_id')::uuid,(rec->>'tag_id')::uuid) on conflict(transaction_id,tag_id) do nothing; end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'scheduled_payments','[]')) loop insert into public.scheduled_payments(id,user_id,recurring_expense_id,transaction_id,description,payment_type,amount,currency,due_date,status,paid_at,client_id) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),nullif(rec->>'recurring_expense_id','')::uuid,nullif(rec->>'transaction_id','')::uuid,rec->>'description',coalesce(rec->>'payment_type','scheduled'),(rec->>'amount')::numeric,coalesce(rec->>'currency','ARS'),(rec->>'due_date')::date,coalesce((rec->>'status')::public.payment_status,'pending'),nullif(rec->>'paid_at','')::timestamptz,coalesce((rec->>'client_id')::uuid,gen_random_uuid())) on conflict(id) do update set description=excluded.description,amount=excluded.amount,due_date=excluded.due_date,status=excluded.status,paid_at=excluded.paid_at,updated_at=now() where scheduled_payments.user_id=auth.uid(); end loop;
end $$;

create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path=public,auth as $$ begin delete from auth.users where id=auth.uid(); end $$;
revoke all on function public.delete_my_account() from public;grant execute on function public.delete_my_account() to authenticated;

do $$ declare t text;begin foreach t in array array['profiles','accounts','credit_cards','categories','transactions','installment_plans','installments','recurring_expenses','budgets','scheduled_payments','tags','transaction_tags'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy %I on public.%I for select to authenticated using (user_id=auth.uid())','select_own_'||t,t);execute format('create policy %I on public.%I for insert to authenticated with check (user_id=auth.uid())','insert_own_'||t,t);execute format('create policy %I on public.%I for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid())','update_own_'||t,t);execute format('create policy %I on public.%I for delete to authenticated using (user_id=auth.uid())','delete_own_'||t,t);end loop;end $$;
