-- ============================================================================
-- ROLE-BASED ACCESS CONTROL WITH ORG ISOLATION - FIXED
-- ============================================================================

-- 1. Drop conflicting functions
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 2. Create orgs table (broker companies)
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text DEFAULT 'basic',
  domain text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- 3. Create user_roles table (SEPARATE from profiles for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('BROKER', 'ADMIN', 'CC_STAFF')),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, org_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create helper functions with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_org(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, check_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role = check_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_cc_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(p_user_id, 'CC_STAFF');
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(p_user_id, 'ADMIN');
$$;

-- 5. Create org_features table for feature flags
CREATE TABLE IF NOT EXISTS public.org_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled boolean DEFAULT true,
  tier text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, feature)
);

ALTER TABLE public.org_features ENABLE ROW LEVEL SECURITY;

-- 6. Create invite_codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
  code text PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  max_uses integer DEFAULT 10,
  used_count integer DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- 7. Create usage_events table for analytics
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_id ON public.user_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_org_features_org ON public.org_features(org_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_org ON public.invite_codes(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_org ON public.usage_events(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON public.usage_events(user_id, created_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- ORGS: Users can view their own org, staff can view all
DROP POLICY IF EXISTS "Users can view their org" ON public.orgs;
CREATE POLICY "Users can view their org"
  ON public.orgs FOR SELECT
  USING (
    id = get_user_org(auth.uid())
    OR is_cc_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update their org" ON public.orgs;
CREATE POLICY "Admins can update their org"
  ON public.orgs FOR UPDATE
  USING (
    id = get_user_org(auth.uid())
    AND is_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can manage all orgs" ON public.orgs;
CREATE POLICY "Staff can manage all orgs"
  ON public.orgs FOR ALL
  USING (is_cc_staff(auth.uid()));

-- USER_ROLES: Users can view their own role, admins can view org roles, staff can view all
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (
    user_id = auth.uid()
    OR (org_id = get_user_org(auth.uid()) AND is_org_admin(auth.uid()))
    OR is_cc_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage org roles" ON public.user_roles;
CREATE POLICY "Admins can manage org roles"
  ON public.user_roles FOR ALL
  USING (
    org_id = get_user_org(auth.uid())
    AND is_org_admin(auth.uid())
  )
  WITH CHECK (
    org_id = get_user_org(auth.uid())
    AND is_org_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can manage all roles" ON public.user_roles;
CREATE POLICY "Staff can manage all roles"
  ON public.user_roles FOR ALL
  USING (is_cc_staff(auth.uid()));

-- ORG_FEATURES: Org members can view, admins can manage
DROP POLICY IF EXISTS "Org members can view features" ON public.org_features;
CREATE POLICY "Org members can view features"
  ON public.org_features FOR SELECT
  USING (
    org_id = get_user_org(auth.uid())
    OR is_cc_staff(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage features" ON public.org_features;
CREATE POLICY "Admins can manage features"
  ON public.org_features FOR ALL
  USING (
    (org_id = get_user_org(auth.uid()) AND is_org_admin(auth.uid()))
    OR is_cc_staff(auth.uid())
  );

-- INVITE_CODES: Admins can manage, anyone can view valid codes for redemption
DROP POLICY IF EXISTS "Anyone can view valid codes" ON public.invite_codes;
CREATE POLICY "Anyone can view valid codes"
  ON public.invite_codes FOR SELECT
  USING (
    expires_at > now() AND used_count < max_uses
  );

DROP POLICY IF EXISTS "Admins can manage invite codes" ON public.invite_codes;
CREATE POLICY "Admins can manage invite codes"
  ON public.invite_codes FOR ALL
  USING (
    (org_id = get_user_org(auth.uid()) AND is_org_admin(auth.uid()))
    OR is_cc_staff(auth.uid())
  )
  WITH CHECK (
    (org_id = get_user_org(auth.uid()) AND is_org_admin(auth.uid()))
    OR is_cc_staff(auth.uid())
  );

-- USAGE_EVENTS: Users can insert their own, org members can view org events
DROP POLICY IF EXISTS "Users can log their own events" ON public.usage_events;
CREATE POLICY "Users can log their own events"
  ON public.usage_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Org members can view org events" ON public.usage_events;
CREATE POLICY "Org members can view org events"
  ON public.usage_events FOR SELECT
  USING (
    org_id = get_user_org(auth.uid())
    OR is_cc_staff(auth.uid())
  );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_cc_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;