CREATE TYPE "PreferredLanguage" AS ENUM ('EN', 'KM');

ALTER TABLE "users"
ADD COLUMN "preferredLanguage" "PreferredLanguage" NOT NULL DEFAULT 'EN';
