-- 0037: Create email-attachments storage bucket and RLS policies

-- 1. Create the bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-attachments',
  'email-attachments',
  false,
  52428800, -- 50MB limit
  null      -- all MIME types allowed
)
on conflict (id) do nothing;

-- 2. Allow authenticated users to upload files to 'email-attachments' bucket inside their user ID folder
create policy "Allow authenticated uploads to email-attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow authenticated users to read files in 'email-attachments' bucket inside their user ID folder
create policy "Allow authenticated reads from email-attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow authenticated users to delete files in 'email-attachments' bucket inside their user ID folder
create policy "Allow authenticated deletes from email-attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
