-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "google_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvVersion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "file_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" SERIAL NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "job_description" TEXT,
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "salary" TEXT,
    "employment_type" TEXT,
    "application_deadline" TIMESTAMP(3),
    "source" TEXT,
    "job_url" TEXT,
    "cv_version_id" INTEGER,
    "cover_letter" TEXT,
    "notes" TEXT,
    "applied_date" TIMESTAMP(3),
    "interview_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT,
    "event_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_google_id_key" ON "User"("google_id");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "idx_timeline_app" ON "TimelineEvent"("application_id");

-- CreateIndex
CREATE INDEX "idx_reminders_app" ON "Reminder"("application_id");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_cv_version_id_fkey" FOREIGN KEY ("cv_version_id") REFERENCES "CvVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
