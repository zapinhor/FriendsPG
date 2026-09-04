-- Novos assets poderão utilizar somente uma URL externa.
alter table public.assets
add column url text;

-- Os campos do Storage deixam de ser obrigatórios.
-- Eles permanecem por enquanto para compatibilidade com assets antigos.
alter table public.assets
alter column storage_path drop not null;

alter table public.assets
alter column mime_type drop not null;

alter table public.assets
alter column size_bytes drop not null;

-- Todo asset precisa ter pelo menos uma origem:
-- URL externa ou arquivo legado no Storage.
alter table public.assets
add constraint assets_has_source_check
check (
  url is not null
  or storage_path is not null
);

-- Quando houver URL externa, aceitamos somente HTTP/HTTPS.
alter table public.assets
add constraint assets_external_url_check
check (
  url is null
  or url ~* '^https?://'
);

-- Não permitimos mais novos uploads diretamente para o bucket.
drop policy if exists "owners and gms can upload campaign assets"
on storage.objects;