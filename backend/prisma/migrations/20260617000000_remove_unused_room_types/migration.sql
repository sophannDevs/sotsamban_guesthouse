-- Migrate any rooms with removed types to SINGLE (safe default)
UPDATE "rooms" SET "type" = 'SINGLE' WHERE "type" IN ('TWIN', 'FAMILY', 'VIP');

-- Recreate RoomType enum with only SINGLE and DOUBLE
CREATE TYPE "RoomType_new" AS ENUM ('SINGLE', 'DOUBLE');

ALTER TABLE "rooms"
  ALTER COLUMN "type" TYPE "RoomType_new"
  USING "type"::text::"RoomType_new";

DROP TYPE "RoomType";
ALTER TYPE "RoomType_new" RENAME TO "RoomType";
