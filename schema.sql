-- Run in Supabase SQL editor.
create table if not exists complaints (
  id uuid primary key,
  title text not null,
  summary text,
  category text not null,
  severity int default 3,
  description text,
  lat double precision not null,
  lng double precision not null,
  address text,
  city text,
  image_url text,
  priority_score int default 0,
  priority_label text,
  duplicate_of uuid,
  duplicate_count int default 0,
  citizen_name text,
  citizen_email text,
  department text,
  authority text,
  portal_url text,
  procedure text,
  contact jsonb default '{}'::jsonb,
  source_urls jsonb default '[]'::jsonb,
  research_confidence text,
  agent_stream_url text,
  draft_text text,
  reference_id text,
  status text not null default 'draft'
    check (status in ('draft','researching','pending_approval','submitted','in_progress','resolved','rejected')),
  created_at timestamptz default now(),
  approved_at timestamptz,
  submitted_at timestamptz,
  resolved_at timestamptz
);

create index if not exists complaints_status_idx on complaints (status);
create index if not exists complaints_category_idx on complaints (category);

-- The backend uses the service role key, so lock the table down for everyone else.
alter table complaints enable row level security;

-- Create a PUBLIC storage bucket named "evidence" in Storage (Dashboard -> Storage -> New bucket).
