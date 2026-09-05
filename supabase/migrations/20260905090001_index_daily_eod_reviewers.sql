create index if not exists daily_eod_reports_reviewed_by_idx
  on public.daily_eod_reports (reviewed_by);
