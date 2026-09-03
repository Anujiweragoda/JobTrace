-- Add user_id column and foreign key to Application
ALTER TABLE "Application" ADD COLUMN "user_id" INTEGER;

-- If an admin user exists, set existing rows to belong to admin to avoid exposing other data by default
DO $$
DECLARE admin_id INTEGER;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE username = 'admin' LIMIT 1;
  IF admin_id IS NOT NULL THEN
    UPDATE "Application" SET "user_id" = admin_id WHERE "user_id" IS NULL;
  END IF;
END
$$;

CREATE INDEX "Application_user_id_idx" ON "Application"("user_id");

ALTER TABLE "Application" ADD CONSTRAINT "Application_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
