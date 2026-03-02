-- Run this in Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard → tu proyecto → SQL Editor

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS boxes_count int DEFAULT 1;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS retenido_nota text;
