-- Optional personality fields for bunny profiles (snacks & hangouts rabbits love).
alter table public.bunnies add column if not exists favorite_snack text;
alter table public.bunnies add column if not exists favorite_hangout text;

comment on column public.bunnies.favorite_snack is 'Short id from app snack list (e.g. cilantro), or legacy free text.';
comment on column public.bunnies.favorite_hangout is 'Short id from app hangout list (e.g. tunnel), or legacy free text.';
