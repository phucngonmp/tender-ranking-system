-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "CrawlJobStatus" AS ENUM ('pending', 'running', 'success', 'failed');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'webhook');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('url', 'muasamcong_keyword', 'bidwinner_keyword', 'dauthauasia_keyword', 'gebiz_keyword', 'freetender_keyword', 'samgov_keyword');

-- CreateEnum
CREATE TYPE "TenderVerdict" AS ENUM ('GO', 'CONSIDER', 'NO_GO');

-- CreateEnum
CREATE TYPE "ScoringEvaluatorType" AS ENUM ('numeric_range', 'list_match', 'date_diff_gte', 'ai_classification');

-- CreateEnum
CREATE TYPE "ScoringAggregation" AS ENUM ('best_tier', 'flat_if_any');

-- CreateEnum
CREATE TYPE "ScoringStatus" AS ENUM ('pending', 'success', 'failed');

-- CreateEnum
CREATE TYPE "ClosedTenderStatus" AS ENUM ('under_evaluation', 'awarded');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" "RoleName" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "receive_emails" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_type" "SourceType" NOT NULL DEFAULT 'url',
    "url" TEXT,
    "keyword" TEXT,
    "min_value" DECIMAL(18,2),
    "max_value" DECIMAL(18,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_score" BOOLEAN NOT NULL DEFAULT true,
    "crawl_hour" INTEGER NOT NULL DEFAULT 2,
    "last_crawled_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industries" TEXT[],
    "technologies" TEXT[],
    "products" TEXT[],
    "keywords" TEXT[],
    "preferred_value_min" DECIMAL(18,2),
    "preferred_value_max" DECIMAL(18,2),
    "positioning" TEXT,
    "services" TEXT[],
    "products_and_solutions" TEXT[],
    "industries_experience" TEXT[],
    "certifications" TEXT[],
    "markets_and_languages" TEXT[],
    "delivery_model" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criteria_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "external_code" TEXT,
    "matched_keyword" TEXT,
    "title" TEXT NOT NULL,
    "investor" TEXT,
    "sector" TEXT,
    "estimated_value" DECIMAL(18,2),
    "currency" TEXT DEFAULT 'VND',
    "submission_open_date" TIMESTAMP(3),
    "submission_deadline" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "locality" TEXT,
    "description" TEXT,
    "requirements_text" TEXT,
    "source_url" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_scores" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "criteria_profile_id" TEXT NOT NULL,
    "ai_score" INTEGER NOT NULL,
    "verdict" "TenderVerdict" NOT NULL DEFAULT 'CONSIDER',
    "ai_rationale" TEXT NOT NULL,
    "matched_criteria" JSONB NOT NULL,
    "gaps" JSONB NOT NULL DEFAULT '[]',
    "risk_flags" JSONB NOT NULL DEFAULT '[]',
    "recommended_focus" JSONB NOT NULL DEFAULT '[]',
    "rule_score" INTEGER NOT NULL,
    "final_score" INTEGER NOT NULL,
    "rubric_score" INTEGER,
    "rubric_breakdown" JSONB,
    "model_used" TEXT NOT NULL,
    "scored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_jobs" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" "CrawlJobStatus" NOT NULL DEFAULT 'pending',
    "items_found" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_digest_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "send_hour" INTEGER NOT NULL DEFAULT 8,
    "send_minute" INTEGER NOT NULL DEFAULT 0,
    "min_score" INTEGER,
    "top_count" INTEGER NOT NULL DEFAULT 5,
    "last_sent_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_digest_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "min_score_threshold" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_attachments" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "document_type" TEXT,
    "storage_path" TEXT,
    "file_size" INTEGER,
    "download_status" TEXT NOT NULL DEFAULT 'pending',
    "download_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_criteria_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "aggregation" "ScoringAggregation" NOT NULL DEFAULT 'best_tier',
    "bonus_points" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_criteria_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_criteria_tiers" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "evaluator_type" "ScoringEvaluatorType" NOT NULL,
    "target_field" TEXT,
    "ai_question_key" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "scoring_criteria_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closed_tender_keywords" (
    "id" TEXT NOT NULL,
    "source_id" TEXT,
    "keyword" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "crawl_hour" INTEGER NOT NULL DEFAULT 3,
    "last_crawled_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closed_tender_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closed_tender_crawl_jobs" (
    "id" TEXT NOT NULL,
    "keyword_id" TEXT NOT NULL,
    "status" "CrawlJobStatus" NOT NULL DEFAULT 'pending',
    "items_found" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "closed_tender_crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closed_tender_results" (
    "id" TEXT NOT NULL,
    "keyword_id" TEXT NOT NULL,
    "notify_no" TEXT NOT NULL,
    "notify_id" TEXT,
    "input_result_id" TEXT,
    "matched_keyword" TEXT,
    "title" TEXT NOT NULL,
    "investor" TEXT,
    "investor_code" TEXT,
    "bid_field" TEXT,
    "locality" TEXT,
    "estimated_value" DECIMAL(18,2),
    "bid_close_date" TIMESTAMP(3),
    "bid_open_date" TIMESTAMP(3),
    "status" "ClosedTenderStatus" NOT NULL,
    "num_bidder_join" INTEGER,
    "decision_no" TEXT,
    "decision_date" TIMESTAMP(3),
    "decision_agency" TEXT,
    "decision_file_id" TEXT,
    "decision_file_name" TEXT,
    "winning_contractor_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "winning_price" DECIMAL(18,2),
    "source_url" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_tender_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closed_tender_bidders" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "org_code" TEXT,
    "org_fullname" TEXT NOT NULL,
    "tax_code" TEXT,
    "bid_price" DECIMAL(18,2),
    "final_price" DECIMAL(18,2),
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "winning_price" DECIMAL(18,2),
    "rank_or_reason" TEXT,
    "execution_time" TEXT,
    "contract_period_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closed_tender_bidders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_assessments" (
    "id" TEXT NOT NULL,
    "company_key" TEXT NOT NULL,
    "tax_code" TEXT,
    "org_fullname" TEXT NOT NULL,
    "threat_level" TEXT NOT NULL,
    "company_summary" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overlap_with_us" TEXT,
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "full_analysis" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "model_used" TEXT NOT NULL,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "requested_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_email_histories" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_msg" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_email_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_configs" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "emails_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webhook_enabled" BOOLEAN NOT NULL DEFAULT false,
    "webhook_url" TEXT,
    "webhook_type" TEXT,
    "min_score_threshold" INTEGER NOT NULL DEFAULT 60,
    "allowed_verdicts" TEXT[] DEFAULT ARRAY['GO', 'CONSIDER']::TEXT[],
    "include_attachments" BOOLEAN NOT NULL DEFAULT false,
    "include_ai_analysis" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_histories" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "status" "ScoringStatus" NOT NULL DEFAULT 'pending',
    "model_used" TEXT,
    "score" INTEGER,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "scoring_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "tenders_source_id_idx" ON "tenders"("source_id");

-- CreateIndex
CREATE INDEX "tenders_external_code_idx" ON "tenders"("external_code");

-- CreateIndex
CREATE INDEX "tender_scores_tender_id_idx" ON "tender_scores"("tender_id");

-- CreateIndex
CREATE INDEX "tender_scores_final_score_idx" ON "tender_scores"("final_score");

-- CreateIndex
CREATE INDEX "crawl_jobs_source_id_idx" ON "crawl_jobs"("source_id");

-- CreateIndex
CREATE INDEX "tender_attachments_tender_id_idx" ON "tender_attachments"("tender_id");

-- CreateIndex
CREATE INDEX "scoring_criteria_tiers_group_id_idx" ON "scoring_criteria_tiers"("group_id");

-- CreateIndex
CREATE INDEX "closed_tender_keywords_source_id_idx" ON "closed_tender_keywords"("source_id");

-- CreateIndex
CREATE INDEX "closed_tender_crawl_jobs_keyword_id_idx" ON "closed_tender_crawl_jobs"("keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "closed_tender_results_notify_no_key" ON "closed_tender_results"("notify_no");

-- CreateIndex
CREATE INDEX "closed_tender_results_keyword_id_idx" ON "closed_tender_results"("keyword_id");

-- CreateIndex
CREATE INDEX "closed_tender_results_status_idx" ON "closed_tender_results"("status");

-- CreateIndex
CREATE INDEX "closed_tender_bidders_result_id_idx" ON "closed_tender_bidders"("result_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_assessments_company_key_key" ON "competitor_assessments"("company_key");

-- CreateIndex
CREATE INDEX "tender_email_histories_tender_id_idx" ON "tender_email_histories"("tender_id");

-- CreateIndex
CREATE INDEX "tender_email_histories_recipient_idx" ON "tender_email_histories"("recipient");

-- CreateIndex
CREATE INDEX "scoring_histories_tender_id_idx" ON "scoring_histories"("tender_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria_profiles" ADD CONSTRAINT "criteria_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_scores" ADD CONSTRAINT "tender_scores_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_scores" ADD CONSTRAINT "tender_scores_criteria_profile_id_fkey" FOREIGN KEY ("criteria_profile_id") REFERENCES "criteria_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_attachments" ADD CONSTRAINT "tender_attachments_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_criteria_tiers" ADD CONSTRAINT "scoring_criteria_tiers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "scoring_criteria_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closed_tender_keywords" ADD CONSTRAINT "closed_tender_keywords_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closed_tender_crawl_jobs" ADD CONSTRAINT "closed_tender_crawl_jobs_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "closed_tender_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closed_tender_results" ADD CONSTRAINT "closed_tender_results_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "closed_tender_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closed_tender_bidders" ADD CONSTRAINT "closed_tender_bidders_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "closed_tender_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_email_histories" ADD CONSTRAINT "tender_email_histories_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_histories" ADD CONSTRAINT "scoring_histories_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

