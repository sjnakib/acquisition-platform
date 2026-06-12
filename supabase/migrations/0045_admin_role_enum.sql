-- 0045: Add 'admin' to user_role enum
-- Must run in its own migration — ALTER TYPE ADD VALUE cannot be combined
-- with other statements that reference the new value in the same transaction.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
