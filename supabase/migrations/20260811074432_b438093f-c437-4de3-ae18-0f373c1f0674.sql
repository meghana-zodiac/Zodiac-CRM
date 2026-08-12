-- Rebuild poa_entries for the new daily POA/KRA workflow
DROP TABLE IF EXISTS public.poa_entries CASCADE;

CREATE TABLE public.poa_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  team_member text NOT NULL,
  calls_made integer NOT NULL DEFAULT 0,
  proposals_sent integer NOT NULL DEFAULT 0,
  deals_closed_value numeric NOT NULL DEFAULT 0,
  actual_revenue numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poa_entries TO anon, authenticated;
GRANT ALL ON public.poa_entries TO service_role;
ALTER TABLE public.poa_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access poa_entries" ON public.poa_entries FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_poa_updated BEFORE UPDATE ON public.poa_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.kra_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  team_member text NOT NULL,
  target_bookings numeric NOT NULL DEFAULT 0,
  target_revenue numeric NOT NULL DEFAULT 0,
  acquired_clients_target integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, team_member)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kra_targets TO anon, authenticated;
GRANT ALL ON public.kra_targets TO service_role;
ALTER TABLE public.kra_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access kra_targets" ON public.kra_targets FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_kra_updated BEFORE UPDATE ON public.kra_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Monthly KRA targets (CAG Team Pipeline, Apr 2026 - Aug 2026)
INSERT INTO public.kra_targets (month, team_member, target_bookings, target_revenue, acquired_clients_target) VALUES
  ('April 2026',     'Edward', 1200000, 1000000, 4),
  ('April 2026',     'Nuzhat', 1000000,  850000, 3),
  ('May 2026',       'Edward', 1300000, 1100000, 4),
  ('May 2026',       'Nuzhat', 1100000,  900000, 3),
  ('June 2026',      'Edward', 1400000, 1200000, 5),
  ('June 2026',      'Nuzhat', 1200000, 1000000, 4),
  ('July 2026',      'Edward', 1500000, 1300000, 5),
  ('July 2026',      'Nuzhat', 1250000, 1050000, 4),
  ('August 2026',    'Edward', 1600000, 1400000, 5),
  ('August 2026',    'Nuzhat', 1300000, 1100000, 4),
  ('September 2026', 'Edward', 1600000, 1400000, 5),
  ('September 2026', 'Nuzhat', 1350000, 1150000, 4);

-- Historical daily log summaries
INSERT INTO public.poa_entries (date, team_member, calls_made, proposals_sent, deals_closed_value, actual_revenue, notes) VALUES
  ('2026-04-07', 'Edward', 38, 4,  420000, 350000, 'Manufacturing cluster outreach; 2 SLAs in negotiation.'),
  ('2026-04-15', 'Edward', 42, 5,  480000, 400000, 'Executive search mandate confirmed.'),
  ('2026-04-24', 'Edward', 35, 3,  360000, 310000, 'Month-end collections follow-up.'),
  ('2026-04-08', 'Nuzhat', 30, 3,  300000, 260000, 'IT staffing leads from LinkedIn campaign.'),
  ('2026-04-17', 'Nuzhat', 34, 4,  340000, 290000, 'Training inquiry converted to quote.'),
  ('2026-04-27', 'Nuzhat', 28, 2,  260000, 230000, 'BGV pilot signed with mid-size client.'),
  ('2026-05-06', 'Edward', 40, 4,  450000, 390000, 'RPO pitch to auto-component client.'),
  ('2026-05-14', 'Edward', 44, 6,  520000, 460000, 'Two SLAs signed this week.'),
  ('2026-05-22', 'Edward', 37, 4,  400000, 350000, 'Pipeline review with CAG.'),
  ('2026-05-07', 'Nuzhat', 32, 3,  320000, 280000, 'Soft skills batch quote sent.'),
  ('2026-05-18', 'Nuzhat', 36, 4,  380000, 330000, 'Comp benchmarking project kickoff.'),
  ('2026-05-26', 'Nuzhat', 29, 3,  290000, 250000, 'Renewal discussions with 3 accounts.'),
  ('2026-06-04', 'Edward', 41, 5,  470000, 420000, 'Leadership hiring mandate won.'),
  ('2026-06-16', 'Edward', 46, 6,  560000, 500000, 'Strong close on staffing pipeline.'),
  ('2026-06-25', 'Edward', 39, 4,  430000, 380000, 'Quarter-end invoicing push.'),
  ('2026-06-09', 'Nuzhat', 33, 4,  360000, 310000, 'Technical training batch scheduled.'),
  ('2026-06-19', 'Nuzhat', 37, 5,  400000, 360000, 'OD intervention scope agreed.'),
  ('2026-06-29', 'Nuzhat', 31, 3,  310000, 280000, 'Quarter wrap-up reviews.'),
  ('2026-07-07', 'Edward', 43, 5,  500000, 450000, 'New logo added in BFSI.'),
  ('2026-07-16', 'Edward', 47, 6,  580000, 520000, 'Two RPO renewals confirmed.'),
  ('2026-07-28', 'Edward', 40, 4,  440000, 400000, 'Collections on track.'),
  ('2026-07-08', 'Nuzhat', 34, 4,  370000, 330000, 'Excel & Power BI batches booked.'),
  ('2026-07-20', 'Nuzhat', 38, 5,  420000, 380000, 'BGV volumes ramping up.'),
  ('2026-07-30', 'Nuzhat', 32, 3,  330000, 300000, 'Month-end pipeline hygiene.'),
  ('2026-08-05', 'Edward', 44, 5,  520000, 470000, 'Pharma client SLA signed.'),
  ('2026-08-14', 'Edward', 48, 7,  600000, 540000, 'Best week of the quarter.'),
  ('2026-08-26', 'Edward', 41, 4,  460000, 410000, 'Focus on high-value mandates.'),
  ('2026-08-06', 'Nuzhat', 35, 4,  390000, 350000, 'Leadership development programme won.'),
  ('2026-08-18', 'Nuzhat', 39, 5,  430000, 390000, 'Two new training accounts onboarded.'),
  ('2026-08-27', 'Nuzhat', 33, 3,  340000, 310000, 'Comp structure report delivered.');