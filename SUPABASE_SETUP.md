# Supabase setup for OASISSCHOLARS

GitHub Pages can still host the website. Supabase will store owner accounts, scholarship posts, uploaded images, and uploaded documents.

Until Supabase is configured, the website runs in local demo mode. Owners can register, log in, post, view, and remove opportunities in the same browser using `localStorage`. This keeps development moving without Firebase/Firestore billing, but those demo posts are not shared with other visitors and should not be treated as production data.

## 1. Create the Supabase project

1. Open Supabase.
2. Create a project.
3. Go to Project Settings > Data API.
4. Copy the Project URL and anon public key.
5. Paste them into `supabase-config.js`.

## 2. Enable owner accounts

In Authentication > Sign In / Providers, enable Email.

If you want owners to log in immediately after registering, keep email confirmation disabled while testing. If you enable email confirmation, owners must confirm their email before posting.

For production, create only the owner accounts you trust, then turn `Allow new users to sign up` off. This prevents strangers from registering and posting scholarships.

## 3. Create the table

Open SQL Editor and run:

```sql
create extension if not exists pgcrypto;

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  provider text not null,
  summary text not null,
  deadline date not null,
  amount text default '',
  apply_url text default '',
  full_info text not null,
  image_url text default '',
  image_path text default '',
  document_url text default '',
  document_path text default '',
  document_name text default '',
  owner_uid uuid not null references auth.users(id) on delete cascade,
  owner_email text default '',
  owner_name text default '',
  created_at timestamptz not null default now()
);

alter table public.opportunities enable row level security;
```

## 4. Add table policies

Run this in SQL Editor:

```sql
create policy "Anyone can read opportunities"
on public.opportunities
for select
using (true);

create policy "Owners can create their own opportunities"
on public.opportunities
for insert
to authenticated
with check (owner_uid = auth.uid());

create policy "Owners can update their own opportunities"
on public.opportunities
for update
to authenticated
using (owner_uid = auth.uid())
with check (owner_uid = auth.uid());

create policy "Owners can delete their own opportunities"
on public.opportunities
for delete
to authenticated
using (owner_uid = auth.uid());
```

## 5. Create storage bucket

In Storage, create a public bucket named:

```text
opportunity-files
```

For stronger protection, set these upload limits in the bucket settings if Supabase shows the options:

- Maximum file size: `5 MB`
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/plain`

## 6. Add storage policies

Run this in SQL Editor:

```sql
create policy "Anyone can read opportunity files"
on storage.objects
for select
using (bucket_id = 'opportunity-files');

create policy "Owners can upload their own opportunity files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'opportunity-files'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Owners can update their own opportunity files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'opportunity-files'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Owners can delete their own opportunity files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'opportunity-files'
  and (storage.foldername(name))[2] = auth.uid()::text
);
```

The app uploads files to paths like `opportunity-images/user-id/file-name`, so the second folder is the owner user id.

## Security checklist

- Keep Row Level Security enabled on `public.opportunities`.
- Never paste the `service_role` key into website files or GitHub.
- Use only the publishable/anon key in `supabase-config.js`.
- In Authentication, keep Email signups enabled only if you are ready to accept new owners.
- After creating trusted owner accounts, disable new signups in Authentication > Sign In / Providers.
- Use strong passwords for owner accounts and remove unknown users from Authentication > Users.
- Review uploaded files regularly in Storage and delete anything suspicious.
- Keep GitHub Pages HTTPS enabled.

## 7. Publish

After adding your real Supabase config:

```powershell
git add .
git commit -m "Connect owner portal to Supabase"
git push origin main
```
