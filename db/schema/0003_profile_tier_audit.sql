-- 0003_profile_tier_audit — record which user changed a profile's tier and when.
-- Previously upgrade/downgrade only flipped profile.tier, leaving no trace of the actor.
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS "tierChangedBy" TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "tierChangedAt" TIMESTAMPTZ;
