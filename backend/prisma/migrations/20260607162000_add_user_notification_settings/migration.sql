CREATE TABLE "user_notification_settings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookingAlerts" BOOLEAN NOT NULL DEFAULT true,
  "paymentAlerts" BOOLEAN NOT NULL DEFAULT true,
  "maintenanceAlerts" BOOLEAN NOT NULL DEFAULT true,
  "systemAlerts" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_notification_settings_userId_key" ON "user_notification_settings"("userId");
CREATE INDEX "user_notification_settings_userId_idx" ON "user_notification_settings"("userId");

ALTER TABLE "user_notification_settings"
  ADD CONSTRAINT "user_notification_settings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
