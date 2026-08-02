begin;

-- Faro no conserva ningún dígito ni fechas fijas de las tarjetas.
alter table public.credit_cards
  drop column if exists last_four,
  drop column if exists closing_day,
  drop column if exists due_day;

alter table public.transactions
  add constraint transactions_credit_due_date_check
  check (payment_method <> 'credit_card' or first_due_date is not null) not valid;

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

create or replace function public.import_user_data(p_payload jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare rec jsonb;v_plan_id uuid;v_transaction_id uuid;begin
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'accounts','[]')) loop insert into public.accounts(id,user_id,name,type,currency,active) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'name',coalesce(rec->>'type','other'),coalesce(rec->>'currency','ARS'),coalesce((rec->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,type=excluded.type,currency=excluded.currency,active=excluded.active,updated_at=now() where accounts.user_id=auth.uid(); end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'credit_cards','[]')) loop insert into public.credit_cards(id,user_id,name,issuer,brand,color,total_limit,available_limit,currency,active) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'name',rec->>'issuer',rec->>'brand',coalesce(rec->>'color','#5658d4'),(rec->>'total_limit')::numeric,nullif(rec->>'available_limit','')::numeric,coalesce(rec->>'currency','ARS'),coalesce((rec->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,issuer=excluded.issuer,brand=excluded.brand,color=excluded.color,total_limit=excluded.total_limit,available_limit=excluded.available_limit,currency=excluded.currency,active=excluded.active,updated_at=now() where credit_cards.user_id=auth.uid(); end loop;
 for rec in select * from jsonb_array_elements(coalesce(p_payload->'categories','[]')) loop insert into public.categories(id,user_id,name,icon,color,sort_order) values(coalesce((rec->>'id')::uuid,gen_random_uuid()),auth.uid(),rec->>'name',coalesce(rec->>'icon','Shapes'),coalesce(rec->>'color','#64748b'),coalesce((rec->>'sort_order')::int,100)) on conflict(id) do update set name=excluded.name,color=excluded.color,updated_at=now() where categories.user_id=auth.uid(); end loop;
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

commit;
