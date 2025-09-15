-- Fix Security Definer View issue by dropping the unused team_member_safe_view
-- This view was bypassing RLS policies on the profiles table

DROP VIEW IF EXISTS public.team_member_safe_view;