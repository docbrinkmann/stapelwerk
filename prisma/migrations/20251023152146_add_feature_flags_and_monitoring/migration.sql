-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "defaultValue" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "environments" TEXT NOT NULL DEFAULT '[]',
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_rules" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flag_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_conditions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flag_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flag_variants" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flag_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_evaluations" (
    "id" TEXT NOT NULL,
    "flagId" TEXT,
    "flagKey" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "value" TEXT NOT NULL,
    "variant" TEXT,
    "reason" TEXT NOT NULL,
    "ruleId" TEXT,
    "context" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_checks" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_alerts" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoring_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_key_idx" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_enabled_idx" ON "feature_flags"("enabled");

-- CreateIndex
CREATE INDEX "feature_flags_createdAt_idx" ON "feature_flags"("createdAt");

-- CreateIndex
CREATE INDEX "feature_flag_rules_flagId_idx" ON "feature_flag_rules"("flagId");

-- CreateIndex
CREATE INDEX "feature_flag_rules_priority_idx" ON "feature_flag_rules"("priority");

-- CreateIndex
CREATE INDEX "feature_flag_conditions_ruleId_idx" ON "feature_flag_conditions"("ruleId");

-- CreateIndex
CREATE INDEX "feature_flag_variants_flagId_idx" ON "feature_flag_variants"("flagId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_variants_flagId_key_key" ON "feature_flag_variants"("flagId", "key");

-- CreateIndex
CREATE INDEX "flag_evaluations_flagKey_idx" ON "flag_evaluations"("flagKey");

-- CreateIndex
CREATE INDEX "flag_evaluations_userId_idx" ON "flag_evaluations"("userId");

-- CreateIndex
CREATE INDEX "flag_evaluations_organizationId_idx" ON "flag_evaluations"("organizationId");

-- CreateIndex
CREATE INDEX "flag_evaluations_timestamp_idx" ON "flag_evaluations"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "health_checks_service_idx" ON "health_checks"("service");

-- CreateIndex
CREATE INDEX "health_checks_status_idx" ON "health_checks"("status");

-- CreateIndex
CREATE INDEX "health_checks_timestamp_idx" ON "health_checks"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "system_metrics_name_idx" ON "system_metrics"("name");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "monitoring_alerts_service_idx" ON "monitoring_alerts"("service");

-- CreateIndex
CREATE INDEX "monitoring_alerts_severity_idx" ON "monitoring_alerts"("severity");

-- CreateIndex
CREATE INDEX "monitoring_alerts_resolved_idx" ON "monitoring_alerts"("resolved");

-- CreateIndex
CREATE INDEX "monitoring_alerts_timestamp_idx" ON "monitoring_alerts"("timestamp" DESC);

-- AddForeignKey
ALTER TABLE "feature_flag_rules" ADD CONSTRAINT "feature_flag_rules_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_conditions" ADD CONSTRAINT "feature_flag_conditions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "feature_flag_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flag_variants" ADD CONSTRAINT "feature_flag_variants_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_evaluations" ADD CONSTRAINT "flag_evaluations_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "feature_flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
