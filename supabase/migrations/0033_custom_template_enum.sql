-- 0033: Add 'custom' value to email_template_key enum for custom templates

alter type public.email_template_key add value 'custom';
