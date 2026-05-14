create type public.email_status as enum (
  'not_sent', 'sent', 'invalid_address', 'gmail_error', 'replied'
);

create type public.response_classification as enum (
  'positive', 'neutral', 'negative', 'no_response'
);

create table public.email_outreach (
  id                      uuid primary key default gen_random_uuid(),
  deal_id                 uuid not null references public.deals(id) on delete cascade,
  contact_id              uuid references public.contacts(id) on delete set null,

  status                  public.email_status not null default 'not_sent',
  sent_at                 timestamptz,
  subject                 text,
  template_used           public.email_template_key,
  gmail_message_id        text,
  gmail_thread_id         text,
  error_message           text,

  response_classification public.response_classification,
  responded_at            timestamptz,

  conversation_log        text,

  thank_you_sent          boolean not null default false,
  thank_you_sent_at       timestamptz,

  declination_sent        boolean not null default false,
  declination_sent_at     timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index email_outreach_deal_idx on public.email_outreach(deal_id);
create index email_outreach_thread_idx on public.email_outreach(gmail_thread_id)
  where gmail_thread_id is not null;
