-- EXAMLAB V9 - API cho chức năng an/hien de, khong doi du lieu de hay tai khoan.
-- Chay SQL nay 1 lan bang SQL Editor trong DU AN Supabase hien tai.
-- Cong khai duy nhat ID cac de dang an, khong cong khai payload/de/loi giai.

create or replace function public.examlab_hidden_deck_ids()
returns table(deck_id text)
language sql stable security definer
set search_path = ''
as $$
  select d.id::text from public.examlab_decks d where d.published is false;
$$;
revoke all on function public.examlab_hidden_deck_ids() from public;
grant execute on function public.examlab_hidden_deck_ids() to anon, authenticated;

-- Chi Admin da duoc cap quyen tren bang examlab_material_admins duoc xem tat ca trang thai.
create or replace function public.examlab_admin_deck_statuses()
returns table(deck_id text, published boolean)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.examlab_material_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  return query select d.id::text, d.published from public.examlab_decks d;
end;
$$;
revoke all on function public.examlab_admin_deck_statuses() from public;
grant execute on function public.examlab_admin_deck_statuses() to authenticated;

-- Bat/tat cong khai truc tiep tren may chu, khong xoa de.
create or replace function public.examlab_admin_set_deck_visibility(p_deck_id text, p_visible boolean)
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare changed_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.examlab_material_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_deck_id is null or length(p_deck_id) > 500 or p_visible is null then
    raise exception 'Invalid arguments';
  end if;
  update public.examlab_decks d
  set published=p_visible, updated_at=now()
  where d.id::text=p_deck_id;
  get diagnostics changed_count = row_count;
  return changed_count > 0;
end;
$$;
revoke all on function public.examlab_admin_set_deck_visibility(text,boolean) from public;
grant execute on function public.examlab_admin_set_deck_visibility(text,boolean) to authenticated;
