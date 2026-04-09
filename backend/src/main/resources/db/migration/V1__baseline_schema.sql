CREATE TABLE IF NOT EXISTS "app_users" (
    "id" UUID PRIMARY KEY,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "password_hash" VARCHAR(255) NOT NULL,
    "timezone" VARCHAR(64),
    "created_at" TIMESTAMP(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS "cycle_logs" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID NOT NULL,
    "encrypted_data" BYTEA NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "data_type" VARCHAR(20) NOT NULL,
    "log_date" DATE,
    CONSTRAINT "fk_cycle_logs_user" FOREIGN KEY ("user_id") REFERENCES "app_users" ("id") ON DELETE CASCADE,
    CONSTRAINT "uk_cycle_logs_user_day" UNIQUE ("user_id", "log_date")
);

CREATE INDEX "idx_cycle_logs_user_id" ON "cycle_logs" ("user_id");
CREATE INDEX "idx_cycle_logs_log_date" ON "cycle_logs" ("log_date");
CREATE INDEX "idx_cycle_logs_timestamp" ON "cycle_logs" ("timestamp");

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL UNIQUE,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "app_users" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id");
CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at");

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
    "id" UUID PRIMARY KEY,
    "bucket_key" VARCHAR(255) NOT NULL,
    "window_start" TIMESTAMP(6) NOT NULL,
    "request_count" INT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "uk_rate_limit_bucket" UNIQUE ("bucket_key", "window_start")
);

CREATE INDEX "idx_rate_limit_key_window" ON "rate_limit_buckets" ("bucket_key", "window_start");
CREATE INDEX "idx_rate_limit_expires_at" ON "rate_limit_buckets" ("expires_at");
