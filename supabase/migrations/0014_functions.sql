create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ declare t text;
begin
  foreach t in array array[
    'profiles','campaigns','deals','email_outreach',
    'document_checklist','underwriting','call_briefs',
    'loi_records','google_tokens','import_jobs'
  ] loop
    execute format('
      create trigger trg_%s_updated_at
      before update on public.%s
      for each row execute procedure public.update_updated_at();
    ', t, t);
  end loop;
end $$;

create or replace function public.get_pipeline_summary()
returns table (
  campaign_name          text,
  market                 text,
  leads                  bigint,
  emails_sent            bigint,
  responses_positive     bigint,
  underwritten           bigint,
  scored_good            bigint,
  loi_count              bigint,
  closed_count           bigint
) language sql stable security definer as $$
  select
    c.name,
    c.market,
    count(*) filter (where d.stage = 'lead')::bigint,
    count(*) filter (where e.status = 'sent')::bigint,
    count(*) filter (where e.response_classification = 'positive')::bigint,
    count(*) filter (where d.stage in ('underwriting','scored','call_scheduled','loi','closed'))::bigint,
    count(*) filter (where d.score in ('good','very_good'))::bigint,
    count(*) filter (where d.stage in ('loi','closed'))::bigint,
    count(*) filter (where d.stage = 'closed')::bigint
  from public.deals d
  join public.campaigns c on c.id = d.campaign_id
  left join public.email_outreach e on e.deal_id = d.id
  where public.get_my_role() = 'internal'
  group by c.id, c.name, c.market
$$;
