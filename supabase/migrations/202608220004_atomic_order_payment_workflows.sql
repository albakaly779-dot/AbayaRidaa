-- Atomic order and payment workflows for AbayaRidaa.
-- The browser calls these RPCs with a user JWT; service-role credentials stay server-side.

create or replace function public.create_order_with_stock(p_order jsonb, p_items jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_user_id uuid := (select auth.uid());
  v_item_code text;
  v_qty numeric;
  v_unit_price numeric;
  v_buy_price numeric;
  v_total numeric;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not (select private.has_any_role('super_admin','general_manager','operations_manager','production','rep','support')) then
    raise exception using errcode = '42501', message = 'Insufficient permission';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'At least one order item is required';
  end if;
  if not (p_order ? 'customer_id') or nullif(p_order ->> 'customer_id', '') is null then
    raise exception using errcode = '22023', message = 'Customer is required';
  end if;

  if not (select private.is_admin()) then
    if not exists (
      select 1 from public.customers c
      where c.id = (p_order ->> 'customer_id')::uuid
        and c.user_id = v_user_id
    ) then
      raise exception using errcode = '42501', message = 'Customer is outside your scope';
    end if;
  end if;

  insert into public.orders (
    user_id, order_number, customer_id, customer_name, customer_phone,
    rep_id, rep_name, status, payment_status, subtotal, discount, total,
    paid, remaining, due_date, notes
  ) values (
    v_user_id,
    coalesce(nullif(p_order ->> 'order_number', ''), 'ORD-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')),
    (p_order ->> 'customer_id')::uuid,
    coalesce(p_order ->> 'customer_name', ''),
    coalesce(p_order ->> 'customer_phone', ''),
    nullif(p_order ->> 'rep_id', '')::uuid,
    nullif(p_order ->> 'rep_name', ''),
    coalesce(nullif(p_order ->> 'status', ''), 'pending'),
    coalesce(nullif(p_order ->> 'payment_status', ''), 'unpaid'),
    coalesce((p_order ->> 'subtotal')::numeric, 0),
    coalesce((p_order ->> 'discount')::numeric, 0),
    coalesce((p_order ->> 'total')::numeric, 0),
    coalesce((p_order ->> 'paid')::numeric, 0),
    coalesce((p_order ->> 'remaining')::numeric, 0),
    nullif(p_order ->> 'due_date', '')::date,
    coalesce(p_order ->> 'notes', '')
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_code := nullif(v_item ->> 'product_code', '');
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, 0);
    v_buy_price := coalesce((v_item ->> 'buy_price')::numeric, 0);
    v_total := coalesce((v_item ->> 'total')::numeric, v_unit_price * v_qty);

    if v_item_code is null or v_qty <= 0 or v_unit_price < 0 then
      raise exception using errcode = '22023', message = 'Invalid order item';
    end if;

    select * into v_product from public.products where code = v_item_code and is_active = true;
    if not found then
      raise exception using errcode = 'P0002', message = 'Product not found: ' || v_item_code;
    end if;

    perform public.decrement_stock(v_item_code, v_qty);

    insert into public.order_items (
      order_id, product_id, product_code, product_name,
      quantity, unit_price, buy_price, total
    ) values (
      v_order.id, v_product.id, v_product.code, coalesce(v_item ->> 'product_name', v_product.name),
      v_qty, v_unit_price, v_buy_price, v_total
    );
  end loop;

  return v_order;
end;
$$;

revoke all on function public.create_order_with_stock(jsonb, jsonb) from public, anon;
grant execute on function public.create_order_with_stock(jsonb, jsonb) to authenticated;

create or replace function public.record_payment_atomic(p_payment jsonb)
returns public.payments
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_user_id uuid := (select auth.uid());
  v_amount numeric := coalesce((p_payment ->> 'amount')::numeric, 0);
  v_new_paid numeric;
  v_new_remaining numeric;
  v_status text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not (select private.has_any_role('super_admin','general_manager','operations_manager','rep','support')) then
    raise exception using errcode = '42501', message = 'Insufficient permission';
  end if;
  if v_amount <= 0 then
    raise exception using errcode = '22023', message = 'Payment amount must be positive';
  end if;

  select * into v_order from public.orders o
  where o.id = (p_payment ->> 'order_id')::uuid
    and (o.user_id = v_user_id or (select private.is_admin()))
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Order is outside your scope';
  end if;
  if v_amount > v_order.remaining then
    raise exception using errcode = '22003', message = 'Payment exceeds remaining balance';
  end if;

  v_new_paid := v_order.paid + v_amount;
  v_new_remaining := v_order.total - v_new_paid;
  v_status := case when v_new_remaining = 0 then 'paid' else 'partial' end;

  insert into public.payments (
    user_id, order_id, customer_id, customer_name, amount, method,
    date, notes, receipt_url, recorded_by_id, recorded_by_name
  ) values (
    v_order.user_id,
    v_order.id,
    v_order.customer_id,
    v_order.customer_name,
    v_amount,
    coalesce(nullif(p_payment ->> 'method', ''), 'cash'),
    coalesce(nullif(p_payment ->> 'date', '')::date, current_date),
    coalesce(p_payment ->> 'notes', ''),
    nullif(p_payment ->> 'receipt_url', ''),
    v_user_id,
    coalesce(p_payment ->> 'recorded_by_name', '')
  ) returning * into v_payment;

  update public.orders
  set paid = v_new_paid, remaining = v_new_remaining, payment_status = v_status, updated_at = now()
  where id = v_order.id;

  return v_payment;
end;
$$;

revoke all on function public.record_payment_atomic(jsonb) from public, anon;
grant execute on function public.record_payment_atomic(jsonb) to authenticated;
