-- Add single account-level currency.
-- Currency is stored on profiles and used for all expenses + visit costs.

alter table public.profiles
add column if not exists currency_code text;

alter table public.profiles
alter column currency_code set default 'PHP';

-- Backfill any null profile currency.
update public.profiles
set currency_code = 'PHP'
where currency_code is null or btrim(currency_code) = '';

-- Overwrite existing row currency codes to match account currency.
-- Expenses
update public.expenses e
set currency = p.currency_code
from public.bunnies b
join public.profiles p on p.id = b.owner_id
where e.bunny_id = b.id
  and (e.currency is distinct from p.currency_code);

-- Medical records visit currency
update public.medical_records r
set visit_cost_currency = p.currency_code
from public.bunnies b
join public.profiles p on p.id = b.owner_id
where r.bunny_id = b.id
  and (r.visit_cost_currency is distinct from p.currency_code);

