-- Local draft only: verify base schema and run SQL tests before deployment.
-- CLI unavailable in this environment; timestamp filename created manually.
-- Shared rules run in the trusted Edge Function; this transaction stores their
-- validated result. No morale coefficients are independently implemented in SQL.
begin;

alter table public.trees add column if not exists spirit_morale jsonb;
alter table public.trees add column if not exists care_revision bigint not null default 0;
-- Owner-approved ONE-TIME legacy initialization. No trigger/default resets morale.
update public.trees set spirit_morale = '{"value":50,"refusing":false}'::jsonb
where spirit_morale is null;
alter table public.trees alter column spirit_morale set not null;
alter table public.trees add constraint trees_spirit_morale_valid check (
  (
    jsonb_typeof(spirit_morale) = 'object'
    and jsonb_typeof(spirit_morale->'value') = 'number'
    and (spirit_morale->>'value')::numeric between 0 and 100
    and jsonb_typeof(spirit_morale->'refusing') = 'boolean'
    and spirit_morale ? 'value' and spirit_morale ? 'refusing'
  )
);

create table public.spirit_morale_events (
  tree_id uuid not null references public.trees(id) on delete cascade,
  event_key text not null,
  game_day integer not null check (game_day >= 0),
  fact jsonb not null check (jsonb_typeof(fact) = 'object' and fact ? 'type'),
  after_state jsonb,
  created_at timestamptz not null default now(),
  primary key (tree_id, event_key)
);
create index spirit_morale_battle_days on public.spirit_morale_events(tree_id, game_day)
where fact->>'type' = 'battle-started';

create table public.care_requests (
  tree_id uuid not null references public.trees(id) on delete cascade,
  request_id uuid not null,
  wallet_id uuid not null,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tree_id, request_id)
);
alter table public.spirit_morale_events enable row level security;
alter table public.care_requests enable row level security;
revoke all on public.spirit_morale_events, public.care_requests from public, anon, authenticated;
grant select, insert, update, delete on public.spirit_morale_events, public.care_requests to service_role;

-- Every log/event writer (including legacy service-role paths) invalidates
-- optimistic engine preparation. Row updates serialize writers on the tree.
create schema if not exists private;
create or replace function private.bump_care_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    update public.trees set care_revision = care_revision + 1 where id = OLD.tree_id;
    return OLD;
  end if;
  if TG_OP = 'UPDATE' and OLD.tree_id <> NEW.tree_id then
    raise exception 'Moving care records between trees is forbidden' using errcode = '22023';
  end if;
  update public.trees set care_revision = care_revision + 1 where id = NEW.tree_id;
  return NEW;
end $$;
create trigger morale_care_log_revision before insert or update or delete on public.care_log_entries
for each row execute function private.bump_care_revision();
create trigger morale_event_revision before insert or update or delete on public.spirit_morale_events
for each row execute function private.bump_care_revision();

-- Keep mutation behind the validated service endpoint, including old RPCs.
revoke insert, update, delete on public.care_log_entries, public.consumables from anon, authenticated;
revoke execute on function public.insert_care_log_entry(uuid,integer,text,jsonb) from public, anon, authenticated;
revoke execute on function public.decrement_consumable(uuid,uuid) from public, anon, authenticated;
grant execute on function public.insert_care_log_entry(uuid,integer,text,jsonb) to service_role;
grant execute on function public.decrement_consumable(uuid,uuid) to service_role;

create or replace function public.read_tree_care_snapshot(p_tree_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'tree', jsonb_build_object('id',t.id,'seed',t.seed,'species',t.species,
      'has_spirit',t.has_spirit,'current_day',t.current_day,'born_at',t.born_at,
      'spirit_morale',t.spirit_morale,'care_revision',t.care_revision),
    'care_log', coalesce((select jsonb_agg(jsonb_build_object(
      'game_day',c.game_day,'sequence',c.sequence,'action_type',c.action_type,'action_data',c.action_data)
      order by c.game_day,c.sequence) from public.care_log_entries c where c.tree_id=t.id),'[]'::jsonb)
  ) from public.trees t where t.id=p_tree_id;
$$;
grant execute on function public.read_tree_care_snapshot(uuid) to anon, authenticated, service_role;

create or replace function public.get_care_commit_context(p_tree_id uuid, p_request_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'tree',to_jsonb(t),
    'care_log',coalesce((select jsonb_agg(to_jsonb(c) order by c.game_day,c.sequence)
      from public.care_log_entries c where c.tree_id=t.id),'[]'::jsonb),
    'battle_days',coalesce((select jsonb_agg(distinct e.game_day)
      from public.spirit_morale_events e where e.tree_id=t.id and e.fact->>'type'='battle-started'),'[]'::jsonb),
    'prior_request',(select to_jsonb(r) from public.care_requests r
      where r.tree_id=t.id and r.request_id=p_request_id)
  ) from public.trees t where t.id=p_tree_id;
$$;
revoke all on function public.get_care_commit_context(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_care_commit_context(uuid,uuid) to service_role;

create or replace function public.commit_care_action(
  p_tree_id uuid, p_wallet_id uuid, p_request_id uuid,
  p_expected_revision bigint, p_request jsonb, p_plan jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_tree public.trees%rowtype;
  v_prior public.care_requests%rowtype;
  v_day integer;
  v_ticks integer;
  v_sequence integer;
  v_cost integer;
  v_item text;
  v_event jsonb;
  v_response jsonb;
  v_count integer;
begin
  select * into v_tree from public.trees where id=p_tree_id for update;
  if not found or v_tree.wallet_id is distinct from p_wallet_id then
    raise exception 'Tree ownership mismatch' using errcode='42501';
  end if;
  select * into v_prior from public.care_requests where tree_id=p_tree_id and request_id=p_request_id;
  if found then
    if v_prior.wallet_id is distinct from p_wallet_id or v_prior.request <> p_request then
      raise exception 'request_id reused with different request' using errcode='22023';
    end if;
    return v_prior.response;
  end if;
  if v_tree.care_revision <> p_expected_revision then
    raise exception 'Care state changed; retry same request_id' using errcode='40001';
  end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object'
     or not (p_plan ?& array['ticks','current_day','last_ticked_at','action_type','action_data',
       'consumable_quantity','morale','events']) then
    raise exception 'Invalid care plan' using errcode='22023';
  end if;
  v_ticks := (p_plan->>'ticks')::integer;
  v_day := (p_plan->>'current_day')::integer;
  if v_ticks not between 0 and 90 or v_day <> v_tree.current_day + v_ticks then
    raise exception 'Invalid day advance' using errcode='22023';
  end if;
  if (p_plan->>'last_ticked_at')::timestamptz <>
      coalesce(v_tree.last_ticked_at,v_tree.born_at) + v_ticks * interval '8 hours'
     or (p_plan->>'last_ticked_at')::timestamptz > clock_timestamp() then
    raise exception 'Invalid tick clock' using errcode='22023';
  end if;
  if p_plan->>'action_type' not in ('water','rotate','prune','fertilize','wire','wire-remove',
      'twine','twine-remove','weight','weight-remove','jin','landscape') then
    raise exception 'Invalid care action' using errcode='22023';
  end if;
  v_item := p_plan->>'consumable_type';
  v_cost := (p_plan->>'consumable_quantity')::integer;
  if v_cost < 0 or (v_item is null and v_cost <> 0) or (v_item is not null and v_cost < 1) then
    raise exception 'Invalid consumable plan' using errcode='22023';
  end if;
  if (p_plan->>'action_type' = 'prune' and (v_item is distinct from 'shears' or v_cost <> 1))
     or (p_plan->>'action_type' = 'fertilize' and (v_item is distinct from 'fertilizer' or v_cost <> 1))
     or (p_plan->>'action_type' = 'wire' and (v_item is distinct from 'wire' or v_cost < 1))
     or (p_plan->>'action_type' not in ('prune','fertilize','wire') and (v_item is not null or v_cost <> 0)) then
    raise exception 'Consumable does not match care action' using errcode='22023';
  end if;
  if v_item is not null then
    update public.consumables set quantity=quantity-v_cost
      where wallet_id=p_wallet_id and item_type=v_item and quantity>=v_cost;
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Insufficient consumable' using errcode='P0001';
    end if;
  end if;
  if v_ticks > 0 then
    for v_sequence in 0..v_ticks-1 loop
      perform public.insert_care_log_entry(p_tree_id,v_tree.current_day+v_sequence,'tick','{}'::jsonb);
    end loop;
  end if;
  perform public.insert_care_log_entry(p_tree_id,v_day,p_plan->>'action_type',p_plan->'action_data');
  for v_event in select value from jsonb_array_elements(p_plan->'events') loop
    insert into public.spirit_morale_events(tree_id,event_key,game_day,fact,after_state)
    values (p_tree_id,v_event->>'event_key',(v_event->>'game_day')::integer,v_event->'fact',v_event->'after');
  end loop;
  update public.trees set current_day=v_day,last_ticked_at=(p_plan->>'last_ticked_at')::timestamptz,
    spirit_morale=p_plan->'morale',care_revision=care_revision+1 where id=p_tree_id;
  v_response := jsonb_build_object('ok',true,'current_day',v_day,
    'elapsed_days',(p_plan->>'elapsed_days')::integer,'morale',p_plan->'morale');
  insert into public.care_requests(tree_id,request_id,wallet_id,request,response)
  values (p_tree_id,p_request_id,p_wallet_id,p_request,v_response);
  return v_response;
end $$;
revoke all on function public.commit_care_action(uuid,uuid,uuid,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.commit_care_action(uuid,uuid,uuid,bigint,jsonb,jsonb) to service_role;

create or replace function public.admit_tree_to_combat(
  p_tree_id uuid, p_wallet_id uuid, p_request_id uuid,
  p_expected_revision bigint, p_expected_morale jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_tree public.trees%rowtype;
  v_key text := 'battle:' || p_request_id::text;
begin
  select * into v_tree from public.trees where id=p_tree_id for update;
  if not found or v_tree.wallet_id is distinct from p_wallet_id then
    raise exception 'Tree ownership mismatch' using errcode='42501';
  end if;
  if exists(select 1 from public.spirit_morale_events
      where tree_id=p_tree_id and event_key=v_key) then
    return jsonb_build_object('ok',true,'allowed',true,'morale',v_tree.spirit_morale);
  end if;
  if v_tree.care_revision <> p_expected_revision
     or v_tree.spirit_morale is distinct from p_expected_morale then
    raise exception 'Spirit state changed; retry same request_id' using errcode='40001';
  end if;
  insert into public.spirit_morale_events(tree_id,event_key,game_day,fact,after_state)
  values (p_tree_id,v_key,v_tree.current_day,
    jsonb_build_object('type','battle-started','requestId',p_request_id),v_tree.spirit_morale);
  return jsonb_build_object('ok',true,'allowed',true,'morale',v_tree.spirit_morale);
end $$;
revoke all on function public.admit_tree_to_combat(uuid,uuid,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.admit_tree_to_combat(uuid,uuid,uuid,bigint,jsonb) to service_role;
commit;
