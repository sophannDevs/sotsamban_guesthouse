-- Step 1: Add businessId as nullable so existing rows can be backfilled
-- before the NOT NULL constraint is enforced below.
ALTER TABLE "guests" ADD COLUMN "businessId" TEXT;

-- Step 2: Backfill existing guests onto the single GUESTHOUSE business.
-- Guests have never been scoped per-business before this migration, so
-- there is no source column to copy from. This only proceeds when the
-- assumption "exactly one GUESTHOUSE business" holds (or there are no
-- existing guests to backfill) — otherwise it raises, so it can never
-- silently mis-assign guest data across tenants. If it raises, backfill
-- "businessId" manually for the affected rows, then re-run this migration.
DO $$
DECLARE
  guesthouse_id TEXT;
  guesthouse_count INT;
  orphan_guest_count INT;
BEGIN
  SELECT COUNT(*) INTO guesthouse_count FROM "businesses" WHERE "type" = 'GUESTHOUSE';

  IF guesthouse_count = 1 THEN
    SELECT "id" INTO guesthouse_id FROM "businesses" WHERE "type" = 'GUESTHOUSE';
    UPDATE "guests" SET "businessId" = guesthouse_id WHERE "businessId" IS NULL;
  ELSE
    SELECT COUNT(*) INTO orphan_guest_count FROM "guests" WHERE "businessId" IS NULL;

    IF orphan_guest_count > 0 THEN
      RAISE EXCEPTION
        'Cannot backfill guests.businessId automatically: found % GUESTHOUSE business(es) and % guest(s) with no businessId. Backfill "businessId" manually for the affected guests, then re-run this migration.',
        guesthouse_count, orphan_guest_count;
    END IF;
  END IF;
END $$;

-- Step 3: Enforce NOT NULL now that every row has a businessId.
ALTER TABLE "guests" ALTER COLUMN "businessId" SET NOT NULL;

-- Step 4: Phone becomes optional — not every guest (e.g. a walk-in who
-- declines to share one) has a phone number, and the unique index below
-- relies on NULL never conflicting.
ALTER TABLE "guests" ALTER COLUMN "phone" DROP NOT NULL;

-- Step 5: Indexes — phone is the primary search key for repeat-guest
-- lookup, so it gets its own index in addition to the compound unique key.
CREATE INDEX "guests_phone_idx" ON "guests"("phone");
CREATE INDEX "guests_businessId_idx" ON "guests"("businessId");
CREATE UNIQUE INDEX "guests_businessId_phone_key" ON "guests"("businessId", "phone");

-- Step 6: Foreign key.
ALTER TABLE "guests"
  ADD CONSTRAINT "guests_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
