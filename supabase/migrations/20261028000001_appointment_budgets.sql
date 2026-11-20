-- Presupuestos voluntarios, propuestas, acuerdos aceptados y gastos reales.

alter table public.appointments
  add column budget_mode text not null default 'invites'
    check (budget_mode in ('invites', 'accepts_contributions', 'split', 'shared_budget')),
  add column budget_currency text not null default 'COP'
    check (budget_currency = 'COP');

grant insert (budget_mode, budget_currency) on public.appointments to authenticated;
grant update (budget_mode, budget_currency) on public.appointments to authenticated;

create table public.appointment_budget_proposals (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references public.appointments (id) on delete cascade,
  couple_id         uuid not null references public.couples (id) on delete cascade,
  request_key       uuid not null,
  proposer_id       uuid not null references auth.users (id) on delete cascade,
  recipient_id      uuid not null references auth.users (id) on delete cascade,
  proposer_amount   numeric(12, 2) not null check (proposer_amount >= 0 and proposer_amount = trunc(proposer_amount)),
  recipient_amount  numeric(12, 2) not null check (recipient_amount >= 0 and recipient_amount = trunc(recipient_amount)),
  message           text check (message is null or char_length(message) <= 500),
  status            text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'countered')),
  parent_proposal_id uuid references public.appointment_budget_proposals (id) on delete set null,
  responded_by      uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,
  constraint budget_proposals_distinct_people check (proposer_id <> recipient_id),
  constraint budget_proposals_nonzero check (proposer_amount + recipient_amount > 0),
  constraint budget_proposals_request_unique unique (appointment_id, proposer_id, request_key)
);

create unique index appointment_budget_one_pending_proposal
  on public.appointment_budget_proposals (appointment_id)
  where status = 'pending';
create index appointment_budget_proposals_couple_idx
  on public.appointment_budget_proposals (couple_id, appointment_id, created_at desc);

create table public.appointment_budget_agreements (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  couple_id      uuid not null references public.couples (id) on delete cascade,
  first_user_id  uuid not null references auth.users (id) on delete cascade,
  first_amount   numeric(12, 2) not null check (first_amount >= 0 and first_amount = trunc(first_amount)),
  second_user_id uuid not null references auth.users (id) on delete cascade,
  second_amount  numeric(12, 2) not null check (second_amount >= 0 and second_amount = trunc(second_amount)),
  total_amount   numeric(12, 2) generated always as (first_amount + second_amount) stored,
  accepted_proposal_id uuid not null references public.appointment_budget_proposals (id),
  updated_at     timestamptz not null default now(),
  constraint budget_agreements_distinct_people check (first_user_id <> second_user_id)
);

create table public.appointment_expenses (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments (id) on delete cascade,
  couple_id       uuid not null references public.couples (id) on delete cascade,
  request_key     uuid not null,
  created_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concept         text not null check (char_length(btrim(concept)) between 1 and 120),
  amount          numeric(12, 2) not null check (amount > 0 and amount = trunc(amount)),
  paid_by         uuid not null references auth.users (id) on delete restrict,
  covered_by      uuid not null references auth.users (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint appointment_expenses_request_unique unique (appointment_id, couple_id, request_key)
);

create index appointment_expenses_appointment_idx
  on public.appointment_expenses (appointment_id, created_at);

create table public.appointment_budget_notifications (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references public.couples (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  actor_id      uuid references auth.users (id) on delete set null,
  proposal_id   uuid references public.appointment_budget_proposals (id) on delete cascade,
  event_type    text not null check (event_type in (
    'proposal_received', 'proposal_accepted', 'proposal_rejected',
    'counteroffer_received', 'agreement_confirmed', 'budget_updated'
  )),
  created_at    timestamptz not null default now(),
  seen_at       timestamptz
);

create index appointment_budget_notifications_recipient_idx
  on public.appointment_budget_notifications (recipient_id, created_at desc);

alter table public.appointment_budget_proposals enable row level security;
alter table public.appointment_budget_agreements enable row level security;
alter table public.appointment_expenses enable row level security;
alter table public.appointment_budget_notifications enable row level security;

revoke all on public.appointment_budget_proposals from anon, authenticated;
revoke all on public.appointment_budget_agreements from anon, authenticated;
revoke all on public.appointment_expenses from anon, authenticated;
revoke all on public.appointment_budget_notifications from anon, authenticated;

grant select on public.appointment_budget_proposals to authenticated;
grant select on public.appointment_budget_agreements to authenticated;
grant select on public.appointment_expenses to authenticated;
grant select on public.appointment_budget_notifications to authenticated;
grant update (seen_at) on public.appointment_budget_notifications to authenticated;

create policy appointment_budget_proposals_select on public.appointment_budget_proposals
  for select to authenticated using (public.is_couple_member(couple_id));
create policy appointment_budget_agreements_select on public.appointment_budget_agreements
  for select to authenticated using (public.is_couple_member(couple_id));
create policy appointment_expenses_select on public.appointment_expenses
  for select to authenticated using (public.is_couple_member(couple_id));
create policy appointment_budget_notifications_select on public.appointment_budget_notifications
  for select to authenticated using (
    recipient_id = (select auth.uid()) and public.is_couple_member(couple_id)
  );
create policy appointment_budget_notifications_mark_seen on public.appointment_budget_notifications
  for update to authenticated using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create trigger appointment_expenses_updated_at before update on public.appointment_expenses
  for each row execute function public.set_updated_at();

create function public.guard_budget_currency_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.budget_mode, new.budget_currency) is distinct from (old.budget_mode, old.budget_currency)
    and exists (
      select 1 from public.appointment_budget_agreements
      where appointment_id = old.id
    )
  then
    raise exception 'budget_agreement_requires_new_proposal' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger appointments_budget_guard before update on public.appointments
  for each row execute function public.guard_budget_currency_change();

create function public.notify_appointment_budget_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if (old.budget, old.budget_mode, old.budget_currency)
    is distinct from (new.budget, new.budget_mode, new.budget_currency)
  then
    insert into public.appointment_budget_notifications (
      couple_id, appointment_id, recipient_id, actor_id, event_type
    )
    select new.couple_id, new.id, member.user_id, v_actor, 'budget_updated'
    from public.couple_members member
    where member.couple_id = new.couple_id
      and member.user_id is distinct from v_actor;
  end if;
  return new;
end;
$$;

create trigger appointments_budget_notification after update on public.appointments
  for each row execute function public.notify_appointment_budget_change();

create function public.notify_budget_proposal_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if tg_op = 'INSERT' then
    v_type := case when new.parent_proposal_id is null
      then 'proposal_received' else 'counteroffer_received' end;
    insert into public.appointment_budget_notifications (
      couple_id, appointment_id, recipient_id, actor_id, proposal_id, event_type
    ) values (
      new.couple_id, new.appointment_id, new.recipient_id, new.proposer_id, new.id, v_type
    );
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'rejected') then
    insert into public.appointment_budget_notifications (
      couple_id, appointment_id, recipient_id, actor_id, proposal_id, event_type
    ) values (
      new.couple_id, new.appointment_id, new.proposer_id, new.responded_by, new.id,
      case when new.status = 'accepted' then 'proposal_accepted' else 'proposal_rejected' end
    );

    if new.status = 'accepted' then
      insert into public.appointment_budget_agreements (
        appointment_id, couple_id, first_user_id, first_amount,
        second_user_id, second_amount, accepted_proposal_id, updated_at
      ) values (
        new.appointment_id, new.couple_id, new.proposer_id, new.proposer_amount,
        new.recipient_id, new.recipient_amount, new.id, now()
      )
      on conflict (appointment_id) do update
        set couple_id = excluded.couple_id,
            first_user_id = excluded.first_user_id,
            first_amount = excluded.first_amount,
            second_user_id = excluded.second_user_id,
            second_amount = excluded.second_amount,
            accepted_proposal_id = excluded.accepted_proposal_id,
            updated_at = excluded.updated_at;

      insert into public.appointment_budget_notifications (
        couple_id, appointment_id, recipient_id, actor_id, proposal_id, event_type
      )
      values
        (new.couple_id, new.appointment_id, new.proposer_id, new.responded_by, new.id, 'agreement_confirmed'),
        (new.couple_id, new.appointment_id, new.recipient_id, new.responded_by, new.id, 'agreement_confirmed');
    end if;
  end if;
  return new;
end;
$$;

create trigger appointment_budget_proposal_notifications
  after insert or update of status on public.appointment_budget_proposals
  for each row execute function public.notify_budget_proposal_event();

create function public.create_appointment_budget_proposal(
  p_appointment_id uuid,
  p_request_key uuid,
  p_proposer_amount numeric,
  p_recipient_amount numeric,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_recipient_id uuid;
  v_proposal_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_request_key is null or p_proposer_amount is null or p_recipient_amount is null
    or p_proposer_amount < 0 or p_recipient_amount < 0
    or p_proposer_amount <> trunc(p_proposer_amount)
    or p_recipient_amount <> trunc(p_recipient_amount)
    or p_proposer_amount + p_recipient_amount <= 0
    or (p_message is not null and char_length(p_message) > 500)
  then
    raise exception 'invalid_budget_proposal' using errcode = 'P0001';
  end if;

  select proposal.id into v_proposal_id
  from public.appointment_budget_proposals proposal
  where proposal.appointment_id = p_appointment_id
    and proposal.proposer_id = v_user_id
    and proposal.request_key = p_request_key;
  if v_proposal_id is not null then return v_proposal_id; end if;

  select member.user_id into v_recipient_id
  from public.couple_members member
  where member.couple_id = v_couple_id and member.user_id <> v_user_id;

  if v_couple_id is null or v_recipient_id is null
    or not exists (
      select 1 from public.appointments appointment
      where appointment.id = p_appointment_id and appointment.couple_id = v_couple_id
    )
  then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;

  insert into public.appointment_budget_proposals (
    appointment_id, couple_id, request_key, proposer_id, recipient_id,
    proposer_amount, recipient_amount, message
  ) values (
    p_appointment_id, v_couple_id, p_request_key, v_user_id, v_recipient_id,
    p_proposer_amount, p_recipient_amount, nullif(btrim(p_message), '')
  )
  returning id into v_proposal_id;
  return v_proposal_id;
end;
$$;

create function public.respond_to_appointment_budget_proposal(
  p_proposal_id uuid,
  p_action text,
  p_request_key uuid,
  p_proposer_amount numeric,
  p_recipient_amount numeric,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.appointment_budget_proposals%rowtype;
  v_new_proposal_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_action is null or p_action not in ('accept', 'reject', 'counter') then
    raise exception 'invalid_budget_response' using errcode = 'P0001';
  end if;

  select * into v_proposal
  from public.appointment_budget_proposals
  where id = p_proposal_id
    and couple_id = public.current_couple_id()
    and recipient_id = v_user_id
    and status = 'pending'
  for update;
  if not found then
    raise exception 'budget_proposal_not_found' using errcode = 'P0001';
  end if;

  if p_action = 'counter' and (
    p_request_key is null or p_proposer_amount is null or p_recipient_amount is null
    or p_proposer_amount < 0 or p_recipient_amount < 0
    or p_proposer_amount <> trunc(p_proposer_amount)
    or p_recipient_amount <> trunc(p_recipient_amount)
    or p_proposer_amount + p_recipient_amount <= 0
    or (p_message is not null and char_length(p_message) > 500)
  ) then
    raise exception 'invalid_budget_proposal' using errcode = 'P0001';
  end if;

  update public.appointment_budget_proposals
  set status = case
        when p_action = 'counter' then 'countered'
        when p_action = 'accept' then 'accepted'
        else 'rejected'
      end,
      responded_by = v_user_id,
      responded_at = now()
  where id = v_proposal.id;

  if p_action = 'counter' then
    insert into public.appointment_budget_proposals (
      appointment_id, couple_id, request_key, proposer_id, recipient_id,
      proposer_amount, recipient_amount, message, parent_proposal_id
    ) values (
      v_proposal.appointment_id, v_proposal.couple_id, p_request_key,
      v_user_id, v_proposal.proposer_id, p_proposer_amount, p_recipient_amount,
      nullif(btrim(p_message), ''), v_proposal.id
    )
    returning id into v_new_proposal_id;
    return v_new_proposal_id;
  end if;

  return v_proposal.id;
end;
$$;

create function public.add_appointment_expense(
  p_appointment_id uuid,
  p_request_key uuid,
  p_concept text,
  p_amount numeric,
  p_paid_by uuid,
  p_covered_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid := public.current_couple_id();
  v_expense_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_request_key is null or p_concept is null
    or char_length(btrim(p_concept)) not between 1 and 120
    or p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount)
  then
    raise exception 'invalid_appointment_expense' using errcode = 'P0001';
  end if;

  insert into public.appointment_expenses (
    appointment_id, couple_id, request_key, created_by, concept, amount, paid_by, covered_by
  )
  select p_appointment_id, v_couple_id, p_request_key, v_user_id, btrim(p_concept), p_amount, p_paid_by, p_covered_by
  where exists (
    select 1 from public.appointments appointment
    where appointment.id = p_appointment_id and appointment.couple_id = v_couple_id
  )
  and exists (
    select 1 from public.couple_members member
    where member.couple_id = v_couple_id and member.user_id = p_paid_by
  )
  and exists (
    select 1 from public.couple_members member
    where member.couple_id = v_couple_id and member.user_id = p_covered_by
  )
  on conflict (appointment_id, couple_id, request_key) do nothing
  returning id into v_expense_id;

  if v_expense_id is null then
    select id into v_expense_id
    from public.appointment_expenses
    where appointment_id = p_appointment_id
      and couple_id = v_couple_id
      and request_key = p_request_key;
  end if;
  if v_expense_id is null then
    raise exception 'appointment_not_found' using errcode = 'P0001';
  end if;
  return v_expense_id;
end;
$$;

revoke all on function public.guard_budget_currency_change() from public, anon, authenticated;
revoke all on function public.notify_appointment_budget_change() from public, anon, authenticated;
revoke all on function public.notify_budget_proposal_event() from public, anon, authenticated;
revoke all on function public.create_appointment_budget_proposal(uuid, uuid, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.respond_to_appointment_budget_proposal(uuid, text, uuid, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.add_appointment_expense(uuid, uuid, text, numeric, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_appointment_budget_proposal(uuid, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.respond_to_appointment_budget_proposal(uuid, text, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.add_appointment_expense(uuid, uuid, text, numeric, uuid, uuid) to authenticated;

alter publication supabase_realtime add table public.appointment_budget_proposals;
alter publication supabase_realtime add table public.appointment_budget_agreements;
alter publication supabase_realtime add table public.appointment_expenses;
alter publication supabase_realtime add table public.appointment_budget_notifications;
