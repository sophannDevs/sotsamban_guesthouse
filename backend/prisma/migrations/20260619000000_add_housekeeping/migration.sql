-- Step 1: Drop the default on rooms.status so PostgreSQL can alter the type cleanly.
ALTER TABLE "rooms" ALTER COLUMN "status" DROP DEFAULT;

-- Step 2: Create the new RoomStatus enum without CLEANING.
CREATE TYPE "RoomStatus_new" AS ENUM (
  'AVAILABLE',
  'BOOKED',
  'OCCUPIED',
  'MAINTENANCE',
  'NEEDS_CLEANING',
  'CLEANING_IN_PROGRESS'
);

-- Step 3: Migrate rooms column — map CLEANING → NEEDS_CLEANING, keep all others.
ALTER TABLE "rooms"
  ALTER COLUMN "status" TYPE "RoomStatus_new"
  USING (
    CASE "status"::text
      WHEN 'CLEANING' THEN 'NEEDS_CLEANING'::"RoomStatus_new"
      ELSE "status"::text::"RoomStatus_new"
    END
  );

-- Step 4: Swap enum names.
DROP TYPE "RoomStatus";
ALTER TYPE "RoomStatus_new" RENAME TO "RoomStatus";

-- Step 5: Restore the default value.
ALTER TABLE "rooms" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE'::"RoomStatus";

-- Step 6: Create HousekeepingStatus enum.
CREATE TYPE "HousekeepingStatus" AS ENUM (
  'NEEDS_CLEANING',
  'CLEANING_IN_PROGRESS',
  'CLEANED',
  'INSPECTED',
  'CANCELLED'
);

-- Step 7: Create HousekeepingPriority enum.
CREATE TYPE "HousekeepingPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

-- Step 8: Create housekeeping_tasks table.
CREATE TABLE "housekeeping_tasks" (
  "id"           TEXT                   NOT NULL,
  "businessId"   TEXT                   NOT NULL,
  "roomId"       TEXT                   NOT NULL,
  "assignedToId" TEXT,
  "bookingId"    TEXT,
  "status"       "HousekeepingStatus"   NOT NULL DEFAULT 'NEEDS_CLEANING',
  "priority"     "HousekeepingPriority" NOT NULL DEFAULT 'MEDIUM',
  "note"         TEXT,
  "startedAt"    TIMESTAMP(3),
  "completedAt"  TIMESTAMP(3),
  "inspectedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

-- Step 9: Indexes.
CREATE INDEX "housekeeping_tasks_businessId_idx"  ON "housekeeping_tasks"("businessId");
CREATE INDEX "housekeeping_tasks_roomId_idx"       ON "housekeeping_tasks"("roomId");
CREATE INDEX "housekeeping_tasks_assignedToId_idx" ON "housekeeping_tasks"("assignedToId");
CREATE INDEX "housekeeping_tasks_bookingId_idx"    ON "housekeeping_tasks"("bookingId");
CREATE INDEX "housekeeping_tasks_status_idx"       ON "housekeeping_tasks"("status");
CREATE INDEX "housekeeping_tasks_priority_idx"     ON "housekeeping_tasks"("priority");

-- Step 10: Foreign key constraints.
ALTER TABLE "housekeeping_tasks"
  ADD CONSTRAINT "housekeeping_tasks_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "housekeeping_tasks"
  ADD CONSTRAINT "housekeeping_tasks_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "housekeeping_tasks"
  ADD CONSTRAINT "housekeeping_tasks_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "housekeeping_tasks"
  ADD CONSTRAINT "housekeeping_tasks_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
