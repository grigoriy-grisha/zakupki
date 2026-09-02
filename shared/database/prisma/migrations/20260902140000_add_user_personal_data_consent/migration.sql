-- Timestamp of the user's one-time personal data processing consent
ALTER TABLE "User" ADD COLUMN "personalDataConsentAt" TIMESTAMP(3);
