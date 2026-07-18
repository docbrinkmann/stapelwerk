-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dockerImage" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'latest',
    "categoryId" INTEGER NOT NULL,
    "ports" TEXT NOT NULL DEFAULT '[]',
    "environmentVariables" TEXT NOT NULL DEFAULT '[]',
    "resourceRequirements" TEXT NOT NULL DEFAULT '{}',
    "compatibilityInfo" TEXT NOT NULL DEFAULT '{}',
    "documentationUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expectedResourceUsage" TEXT NOT NULL DEFAULT '{}',
    "performanceTier" TEXT DEFAULT 'standard',
    "slaRequirements" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_imports" (
    "id" SERIAL NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "extractedMetadata" TEXT NOT NULL DEFAULT '{}',
    "submittedBy" TEXT,
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "serviceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stacks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "performanceMonitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metricsRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "costTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "performanceConfig" TEXT NOT NULL DEFAULT '{}',
    "organizationId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stack_services" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stack_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stack_service_configurations" (
    "id" TEXT NOT NULL,
    "stackServiceId" TEXT NOT NULL,
    "environmentVariables" TEXT NOT NULL DEFAULT '{}',
    "portMappings" TEXT NOT NULL DEFAULT '{}',
    "volumeMounts" TEXT NOT NULL DEFAULT '{}',
    "dependsOn" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stack_service_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "targetStackId" TEXT,
    "userId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL DEFAULT '1.0',
    "metadata" TEXT DEFAULT '{}',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "adoptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_patterns" (
    "id" TEXT NOT NULL,
    "serviceIds" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "minStackSize" INTEGER NOT NULL DEFAULT 1,
    "maxStackSize" INTEGER NOT NULL DEFAULT 10,
    "metadata" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "rating" INTEGER,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "contextData" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "use_case_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedSetupTime" TEXT NOT NULL,
    "serviceIds" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "use_case_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_usage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "userId" TEXT,
    "servicesAdded" INTEGER NOT NULL DEFAULT 0,
    "successful" BOOLEAN,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_ratings" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "serviceIds" TEXT NOT NULL,
    "metadata" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_targets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployment_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_target_overrides" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "stackId" TEXT,
    "overrides" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployment_target_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_artifacts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "location" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "stackId" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_jobs" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "logs" TEXT NOT NULL DEFAULT '[]',
    "stackId" TEXT,
    "targetId" TEXT,
    "artifactId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployment_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "metricType" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "unit" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "aggregationPeriod" TEXT DEFAULT '1m',
    "tags" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_metrics" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "metricNamespace" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" DECIMAL(65,30) NOT NULL,
    "metricUnit" TEXT,
    "metricType" TEXT NOT NULL,
    "labels" TEXT NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_events" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "logLevel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "structuredData" TEXT NOT NULL DEFAULT '{}',
    "errorType" TEXT,
    "errorStack" TEXT,
    "traceId" TEXT,
    "spanId" TEXT,
    "sourceFile" TEXT,
    "sourceLine" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_baselines" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "metricType" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "baselineValue" DECIMAL(65,30) NOT NULL,
    "stdDeviation" DECIMAL(65,30),
    "minValue" DECIMAL(65,30),
    "maxValue" DECIMAL(65,30),
    "sampleCount" INTEGER NOT NULL,
    "calculationPeriodStart" TIMESTAMP(3) NOT NULL,
    "calculationPeriodEnd" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optimization_recommendations" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "recommendationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impactScore" DECIMAL(65,30) NOT NULL,
    "confidenceScore" DECIMAL(65,30) NOT NULL,
    "estimatedSavings" TEXT,
    "implementationComplexity" TEXT NOT NULL,
    "configurationChanges" TEXT NOT NULL,
    "status" TEXT DEFAULT 'pending',
    "appliedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "userFeedback" TEXT,
    "feedbackComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "optimization_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "alertName" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DECIMAL(65,30) NOT NULL,
    "durationSeconds" INTEGER DEFAULT 60,
    "severity" TEXT NOT NULL,
    "notificationChannels" TEXT NOT NULL DEFAULT '[]',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "triggerCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_history" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "triggeredValue" DECIMAL(65,30) NOT NULL,
    "thresholdValue" DECIMAL(65,30) NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT DEFAULT 'active',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationChannels" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_analysis" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "provider" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceUnits" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30) NOT NULL,
    "totalCost" DECIMAL(65,30) NOT NULL,
    "currency" TEXT DEFAULT 'USD',
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "costBreakdown" TEXT,
    "optimizationPotential" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scaling_policies" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "policyName" TEXT NOT NULL,
    "policyType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minReplicas" INTEGER DEFAULT 1,
    "maxReplicas" INTEGER DEFAULT 10,
    "targetMetric" TEXT NOT NULL,
    "targetValue" DECIMAL(65,30) NOT NULL,
    "scaleUpThreshold" DECIMAL(65,30),
    "scaleDownThreshold" DECIMAL(65,30),
    "cooldownSeconds" INTEGER DEFAULT 300,
    "configuration" TEXT NOT NULL,
    "lastScaledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scaling_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metric" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "schedule" TEXT,
    "hysteresis" TEXT,
    "cooldownMinutes" INTEGER DEFAULT 15,
    "isComposite" BOOLEAN NOT NULL DEFAULT false,
    "compositeLogic" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "value" DECIMAL(65,30),
    "threshold" DECIMAL(65,30),
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "acknowledgmentNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "escalationLevel" INTEGER DEFAULT 0,
    "notificationsSent" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "stackId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "testStatus" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_scaling_configs" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minInstances" INTEGER NOT NULL DEFAULT 1,
    "maxInstances" INTEGER NOT NULL DEFAULT 10,
    "targetCpuUtilization" INTEGER,
    "targetMemoryUtilization" INTEGER,
    "targetRequestRate" INTEGER,
    "customMetrics" TEXT,
    "scaleUpRate" INTEGER DEFAULT 1,
    "scaleDownRate" INTEGER DEFAULT 1,
    "cooldownPeriod" INTEGER DEFAULT 300,
    "predictiveScaling" BOOLEAN NOT NULL DEFAULT false,
    "configuration" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_scaling_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_scaling_events" (
    "id" TEXT NOT NULL,
    "configId" TEXT,
    "policyId" TEXT,
    "stackId" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousCount" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL,
    "metrics" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_scaling_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_policies" (
    "id" TEXT NOT NULL,
    "stackId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "levels" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_models" (
    "id" TEXT NOT NULL,
    "stackId" TEXT,
    "serviceId" INTEGER,
    "modelType" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "trainingData" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastTrainedAt" TIMESTAMP(3),
    "nextTrainingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "currentOrganizationId" TEXT,
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationContext" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deviceInfo" JSONB NOT NULL,
    "securityFlags" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedAt" TIMESTAMP(3),
    "invitedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stack_permissions" (
    "id" TEXT NOT NULL,
    "stackId" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "permissionType" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stack_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'stack_change',
    "stackId" TEXT,
    "organizationId" TEXT NOT NULL,
    "changes" TEXT,
    "metadata" TEXT DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deployedAt" TIMESTAMP(3),

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_comments" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'organization',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "configuration" TEXT NOT NULL DEFAULT '{}',
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "parentTemplateId" TEXT,
    "customizations" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "approvalWorkflowId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_template_usage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stackId" TEXT,
    "customizationsUsed" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_template_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "eventData" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerability_scans" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "vulnerabilities_found" INTEGER,
    "misconfigurations_found" INTEGER,
    "scan_duration" INTEGER,
    "trivy_version" TEXT,
    "database_version" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vulnerability_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerabilities" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "installedVersion" TEXT NOT NULL,
    "fixedVersion" TEXT,
    "cvssScore" DOUBLE PRECISION,
    "cvssVector" TEXT,
    "references" TEXT NOT NULL DEFAULT '[]',
    "publishedDate" TIMESTAMP(3),
    "lastModifiedDate" TIMESTAMP(3),
    "exploitable" BOOLEAN NOT NULL DEFAULT false,
    "patchAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vulnerabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_misconfigurations" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "file" TEXT,
    "line" INTEGER,
    "remediation" TEXT,
    "references" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_misconfigurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_scan_summaries" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "total_vulnerabilities" INTEGER NOT NULL DEFAULT 0,
    "critical_vulnerabilities" INTEGER NOT NULL DEFAULT 0,
    "high_vulnerabilities" INTEGER NOT NULL DEFAULT 0,
    "medium_vulnerabilities" INTEGER NOT NULL DEFAULT 0,
    "low_vulnerabilities" INTEGER NOT NULL DEFAULT 0,
    "unknown_vulnerabilities" INTEGER NOT NULL DEFAULT 0,
    "total_misconfigurations" INTEGER NOT NULL DEFAULT 0,
    "security_score" DOUBLE PRECISION,
    "risk_level" TEXT NOT NULL,
    "last_scan_date" TIMESTAMP(3) NOT NULL,
    "next_scan_scheduled" TIMESTAMP(3),
    "scan_frequency" TEXT NOT NULL DEFAULT 'weekly',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_scan_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vulnerability_exceptions" (
    "id" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "exceptionType" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "target_pattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vulnerability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_metrics_snapshots" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "total_vulnerabilities" INTEGER NOT NULL DEFAULT 0,
    "critical_count" INTEGER NOT NULL DEFAULT 0,
    "high_count" INTEGER NOT NULL DEFAULT 0,
    "medium_count" INTEGER NOT NULL DEFAULT 0,
    "low_count" INTEGER NOT NULL DEFAULT 0,
    "unknown_count" INTEGER NOT NULL DEFAULT 0,
    "security_score" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "scan_count" INTEGER NOT NULL DEFAULT 0,
    "targets_scanned" INTEGER NOT NULL DEFAULT 0,
    "active_exceptions" INTEGER NOT NULL DEFAULT 0,
    "mean_cvss_score" DOUBLE PRECISION,
    "vulnerability_density" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_metrics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_analysis_cache" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "analysis_data" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "data_points_count" INTEGER NOT NULL DEFAULT 0,
    "recommendations_count" INTEGER NOT NULL DEFAULT 0,
    "anomalies_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trend_analysis_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_anomalies" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "anomaly_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actual_value" DOUBLE PRECISION NOT NULL,
    "expected_min" DOUBLE PRECISION NOT NULL,
    "expected_max" DOUBLE PRECISION NOT NULL,
    "deviation_magnitude" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "impact_assessment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remediation_metrics" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vulnerabilities_fixed" INTEGER NOT NULL DEFAULT 0,
    "vulnerabilities_introduced" INTEGER NOT NULL DEFAULT 0,
    "mean_time_to_fix_hours" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "median_time_to_fix_hours" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "fix_rate_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "backlog_count" INTEGER NOT NULL DEFAULT 0,
    "critical_backlog_count" INTEGER NOT NULL DEFAULT 0,
    "high_backlog_count" INTEGER NOT NULL DEFAULT 0,
    "sla_compliance_rate" DOUBLE PRECISION,
    "automation_rate" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remediation_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_forecasts" (
    "id" TEXT NOT NULL,
    "forecast_date" TIMESTAMP(3) NOT NULL,
    "period" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "predicted_value" DOUBLE PRECISION NOT NULL,
    "confidence_interval_lower" DOUBLE PRECISION NOT NULL,
    "confidence_interval_upper" DOUBLE PRECISION NOT NULL,
    "prediction_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "model_used" TEXT NOT NULL,
    "model_accuracy" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actual_value" DOUBLE PRECISION,
    "accuracy_score" DOUBLE PRECISION,

    CONSTRAINT "security_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_seasonal_patterns" (
    "id" TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "pattern_data" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "description" TEXT NOT NULL,
    "first_detected" TIMESTAMP(3) NOT NULL,
    "last_confirmed" TIMESTAMP(3) NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_seasonal_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_trend_recommendations" (
    "id" TEXT NOT NULL,
    "recommendation_type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_impact" TEXT NOT NULL,
    "implementation_effort" TEXT,
    "related_metric" TEXT,
    "related_trend" TEXT,
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "is_automated" BOOLEAN NOT NULL DEFAULT false,
    "automation_config" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "implemented_at" TIMESTAMP(3),
    "implemented_by" TEXT,
    "dismissal_reason" TEXT,
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),

    CONSTRAINT "security_trend_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_benchmarks" (
    "id" TEXT NOT NULL,
    "benchmark_name" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "threshold_good" DOUBLE PRECISION,
    "threshold_poor" DOUBLE PRECISION,
    "description" TEXT,
    "source" TEXT,
    "last_updated" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TemplateServices" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_sortOrder_idx" ON "categories"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_slug_idx" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_categoryId_idx" ON "services"("categoryId");

-- CreateIndex
CREATE INDEX "services_status_idx" ON "services"("status");

-- CreateIndex
CREATE INDEX "services_featured_idx" ON "services"("featured");

-- CreateIndex
CREATE INDEX "services_dockerImage_idx" ON "services"("dockerImage");

-- CreateIndex
CREATE INDEX "service_imports_status_idx" ON "service_imports"("status");

-- CreateIndex
CREATE INDEX "service_imports_sourceType_idx" ON "service_imports"("sourceType");

-- CreateIndex
CREATE INDEX "service_imports_serviceId_idx" ON "service_imports"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "stacks_slug_key" ON "stacks"("slug");

-- CreateIndex
CREATE INDEX "stacks_userId_idx" ON "stacks"("userId");

-- CreateIndex
CREATE INDEX "stacks_status_idx" ON "stacks"("status");

-- CreateIndex
CREATE INDEX "stacks_isPublic_idx" ON "stacks"("isPublic");

-- CreateIndex
CREATE INDEX "stacks_slug_idx" ON "stacks"("slug");

-- CreateIndex
CREATE INDEX "stacks_performanceMonitoringEnabled_idx" ON "stacks"("performanceMonitoringEnabled");

-- CreateIndex
CREATE INDEX "stacks_organizationId_idx" ON "stacks"("organizationId");

-- CreateIndex
CREATE INDEX "stacks_visibility_idx" ON "stacks"("visibility");

-- CreateIndex
CREATE INDEX "stack_services_stackId_idx" ON "stack_services"("stackId");

-- CreateIndex
CREATE INDEX "stack_services_serviceId_idx" ON "stack_services"("serviceId");

-- CreateIndex
CREATE INDEX "stack_services_stackId_order_idx" ON "stack_services"("stackId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "stack_services_stackId_serviceId_key" ON "stack_services"("stackId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "stack_service_configurations_stackServiceId_key" ON "stack_service_configurations"("stackServiceId");

-- CreateIndex
CREATE INDEX "stack_service_configurations_stackServiceId_idx" ON "stack_service_configurations"("stackServiceId");

-- CreateIndex
CREATE INDEX "recommendations_serviceId_idx" ON "recommendations"("serviceId");

-- CreateIndex
CREATE INDEX "recommendations_targetStackId_idx" ON "recommendations"("targetStackId");

-- CreateIndex
CREATE INDEX "recommendations_userId_idx" ON "recommendations"("userId");

-- CreateIndex
CREATE INDEX "recommendations_score_idx" ON "recommendations"("score");

-- CreateIndex
CREATE INDEX "recommendations_category_idx" ON "recommendations"("category");

-- CreateIndex
CREATE INDEX "recommendations_createdAt_idx" ON "recommendations"("createdAt");

-- CreateIndex
CREATE INDEX "recommendation_patterns_category_idx" ON "recommendation_patterns"("category");

-- CreateIndex
CREATE INDEX "recommendation_patterns_frequency_idx" ON "recommendation_patterns"("frequency");

-- CreateIndex
CREATE INDEX "recommendation_patterns_successRate_idx" ON "recommendation_patterns"("successRate");

-- CreateIndex
CREATE INDEX "recommendation_patterns_minStackSize_maxStackSize_idx" ON "recommendation_patterns"("minStackSize", "maxStackSize");

-- CreateIndex
CREATE INDEX "recommendation_feedback_recommendationId_idx" ON "recommendation_feedback"("recommendationId");

-- CreateIndex
CREATE INDEX "recommendation_feedback_userId_idx" ON "recommendation_feedback"("userId");

-- CreateIndex
CREATE INDEX "recommendation_feedback_sessionId_idx" ON "recommendation_feedback"("sessionId");

-- CreateIndex
CREATE INDEX "recommendation_feedback_action_idx" ON "recommendation_feedback"("action");

-- CreateIndex
CREATE INDEX "recommendation_feedback_rating_idx" ON "recommendation_feedback"("rating");

-- CreateIndex
CREATE INDEX "recommendation_feedback_createdAt_idx" ON "recommendation_feedback"("createdAt");

-- CreateIndex
CREATE INDEX "use_case_templates_category_idx" ON "use_case_templates"("category");

-- CreateIndex
CREATE INDEX "use_case_templates_difficulty_idx" ON "use_case_templates"("difficulty");

-- CreateIndex
CREATE INDEX "use_case_templates_featured_idx" ON "use_case_templates"("featured");

-- CreateIndex
CREATE INDEX "use_case_templates_usageCount_idx" ON "use_case_templates"("usageCount");

-- CreateIndex
CREATE INDEX "use_case_templates_isActive_idx" ON "use_case_templates"("isActive");

-- CreateIndex
CREATE INDEX "use_case_templates_createdAt_idx" ON "use_case_templates"("createdAt");

-- CreateIndex
CREATE INDEX "template_usage_templateId_idx" ON "template_usage"("templateId");

-- CreateIndex
CREATE INDEX "template_usage_stackId_idx" ON "template_usage"("stackId");

-- CreateIndex
CREATE INDEX "template_usage_userId_idx" ON "template_usage"("userId");

-- CreateIndex
CREATE INDEX "template_usage_createdAt_idx" ON "template_usage"("createdAt");

-- CreateIndex
CREATE INDEX "template_ratings_templateId_idx" ON "template_ratings"("templateId");

-- CreateIndex
CREATE INDEX "template_ratings_userId_idx" ON "template_ratings"("userId");

-- CreateIndex
CREATE INDEX "template_ratings_rating_idx" ON "template_ratings"("rating");

-- CreateIndex
CREATE INDEX "template_ratings_createdAt_idx" ON "template_ratings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "template_ratings_templateId_userId_key" ON "template_ratings"("templateId", "userId");

-- CreateIndex
CREATE INDEX "template_versions_templateId_idx" ON "template_versions"("templateId");

-- CreateIndex
CREATE INDEX "template_versions_version_idx" ON "template_versions"("version");

-- CreateIndex
CREATE INDEX "template_versions_createdAt_idx" ON "template_versions"("createdAt");

-- CreateIndex
CREATE INDEX "deployment_targets_type_idx" ON "deployment_targets"("type");

-- CreateIndex
CREATE INDEX "deployment_targets_provider_idx" ON "deployment_targets"("provider");

-- CreateIndex
CREATE INDEX "deployment_targets_userId_idx" ON "deployment_targets"("userId");

-- CreateIndex
CREATE INDEX "deployment_target_overrides_targetId_idx" ON "deployment_target_overrides"("targetId");

-- CreateIndex
CREATE INDEX "deployment_target_overrides_serviceId_idx" ON "deployment_target_overrides"("serviceId");

-- CreateIndex
CREATE INDEX "deployment_target_overrides_stackId_idx" ON "deployment_target_overrides"("stackId");

-- CreateIndex
CREATE UNIQUE INDEX "deployment_target_overrides_targetId_serviceId_stackId_key" ON "deployment_target_overrides"("targetId", "serviceId", "stackId");

-- CreateIndex
CREATE INDEX "deployment_artifacts_type_idx" ON "deployment_artifacts"("type");

-- CreateIndex
CREATE INDEX "deployment_artifacts_stackId_idx" ON "deployment_artifacts"("stackId");

-- CreateIndex
CREATE INDEX "deployment_artifacts_targetId_idx" ON "deployment_artifacts"("targetId");

-- CreateIndex
CREATE INDEX "deployment_artifacts_checksum_idx" ON "deployment_artifacts"("checksum");

-- CreateIndex
CREATE INDEX "deployment_jobs_mode_idx" ON "deployment_jobs"("mode");

-- CreateIndex
CREATE INDEX "deployment_jobs_status_idx" ON "deployment_jobs"("status");

-- CreateIndex
CREATE INDEX "deployment_jobs_stackId_idx" ON "deployment_jobs"("stackId");

-- CreateIndex
CREATE INDEX "deployment_jobs_targetId_idx" ON "deployment_jobs"("targetId");

-- CreateIndex
CREATE INDEX "deployment_jobs_artifactId_idx" ON "deployment_jobs"("artifactId");

-- CreateIndex
CREATE INDEX "deployment_jobs_createdAt_idx" ON "deployment_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "performance_metrics_stackId_timestamp_idx" ON "performance_metrics"("stackId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "performance_metrics_serviceId_timestamp_idx" ON "performance_metrics"("serviceId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "performance_metrics_metricType_timestamp_idx" ON "performance_metrics"("metricType", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "performance_metrics_timestamp_idx" ON "performance_metrics"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "custom_metrics_stackId_timestamp_idx" ON "custom_metrics"("stackId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "custom_metrics_metricNamespace_metricName_idx" ON "custom_metrics"("metricNamespace", "metricName");

-- CreateIndex
CREATE INDEX "log_events_stackId_timestamp_idx" ON "log_events"("stackId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "log_events_logLevel_timestamp_idx" ON "log_events"("logLevel", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "log_events_errorType_idx" ON "log_events"("errorType");

-- CreateIndex
CREATE INDEX "log_events_traceId_idx" ON "log_events"("traceId");

-- CreateIndex
CREATE INDEX "performance_baselines_stackId_idx" ON "performance_baselines"("stackId");

-- CreateIndex
CREATE INDEX "performance_baselines_isActive_idx" ON "performance_baselines"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "performance_baselines_stackId_serviceId_metricType_metricNa_key" ON "performance_baselines"("stackId", "serviceId", "metricType", "metricName");

-- CreateIndex
CREATE INDEX "optimization_recommendations_stackId_idx" ON "optimization_recommendations"("stackId");

-- CreateIndex
CREATE INDEX "optimization_recommendations_status_idx" ON "optimization_recommendations"("status");

-- CreateIndex
CREATE INDEX "optimization_recommendations_createdAt_idx" ON "optimization_recommendations"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "performance_alerts_userId_idx" ON "performance_alerts"("userId");

-- CreateIndex
CREATE INDEX "performance_alerts_stackId_idx" ON "performance_alerts"("stackId");

-- CreateIndex
CREATE INDEX "performance_alerts_isEnabled_idx" ON "performance_alerts"("isEnabled");

-- CreateIndex
CREATE INDEX "alert_history_alertId_idx" ON "alert_history"("alertId");

-- CreateIndex
CREATE INDEX "alert_history_stackId_idx" ON "alert_history"("stackId");

-- CreateIndex
CREATE INDEX "alert_history_triggeredAt_idx" ON "alert_history"("triggeredAt" DESC);

-- CreateIndex
CREATE INDEX "alert_history_status_idx" ON "alert_history"("status");

-- CreateIndex
CREATE INDEX "cost_analysis_stackId_idx" ON "cost_analysis"("stackId");

-- CreateIndex
CREATE INDEX "cost_analysis_billingPeriodStart_billingPeriodEnd_idx" ON "cost_analysis"("billingPeriodStart", "billingPeriodEnd");

-- CreateIndex
CREATE INDEX "scaling_policies_stackId_idx" ON "scaling_policies"("stackId");

-- CreateIndex
CREATE INDEX "scaling_policies_serviceId_idx" ON "scaling_policies"("serviceId");

-- CreateIndex
CREATE INDEX "scaling_policies_isEnabled_idx" ON "scaling_policies"("isEnabled");

-- CreateIndex
CREATE INDEX "alert_rules_stackId_idx" ON "alert_rules"("stackId");

-- CreateIndex
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules"("enabled");

-- CreateIndex
CREATE INDEX "alert_rules_severity_idx" ON "alert_rules"("severity");

-- CreateIndex
CREATE INDEX "alerts_ruleId_idx" ON "alerts"("ruleId");

-- CreateIndex
CREATE INDEX "alerts_stackId_idx" ON "alerts"("stackId");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_triggeredAt_idx" ON "alerts"("triggeredAt" DESC);

-- CreateIndex
CREATE INDEX "notification_channels_userId_idx" ON "notification_channels"("userId");

-- CreateIndex
CREATE INDEX "notification_channels_stackId_idx" ON "notification_channels"("stackId");

-- CreateIndex
CREATE INDEX "notification_channels_type_idx" ON "notification_channels"("type");

-- CreateIndex
CREATE INDEX "auto_scaling_configs_enabled_idx" ON "auto_scaling_configs"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "auto_scaling_configs_stackId_serviceId_key" ON "auto_scaling_configs"("stackId", "serviceId");

-- CreateIndex
CREATE INDEX "auto_scaling_events_stackId_idx" ON "auto_scaling_events"("stackId");

-- CreateIndex
CREATE INDEX "auto_scaling_events_serviceId_idx" ON "auto_scaling_events"("serviceId");

-- CreateIndex
CREATE INDEX "auto_scaling_events_timestamp_idx" ON "auto_scaling_events"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "escalation_policies_stackId_idx" ON "escalation_policies"("stackId");

-- CreateIndex
CREATE INDEX "escalation_policies_isDefault_idx" ON "escalation_policies"("isDefault");

-- CreateIndex
CREATE INDEX "ml_models_stackId_idx" ON "ml_models"("stackId");

-- CreateIndex
CREATE INDEX "ml_models_modelType_idx" ON "ml_models"("modelType");

-- CreateIndex
CREATE INDEX "ml_models_isActive_idx" ON "ml_models"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_currentOrganizationId_idx" ON "users"("currentOrganizationId");

-- CreateIndex
CREATE INDEX "users_lastActivity_idx" ON "users"("lastActivity");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_sessionToken_key" ON "user_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_sessionToken_idx" ON "user_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "user_sessions_isActive_idx" ON "user_sessions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_createdBy_idx" ON "organizations"("createdBy");

-- CreateIndex
CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE INDEX "organization_members_role_idx" ON "organization_members"("role");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_key" ON "organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_organizationId_idx" ON "organization_invitations"("organizationId");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");

-- CreateIndex
CREATE INDEX "organization_invitations_token_idx" ON "organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_status_idx" ON "organization_invitations"("status");

-- CreateIndex
CREATE INDEX "organization_invitations_expiresAt_idx" ON "organization_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "organization_invitations_invitedBy_idx" ON "organization_invitations"("invitedBy");

-- CreateIndex
CREATE INDEX "stack_permissions_stackId_idx" ON "stack_permissions"("stackId");

-- CreateIndex
CREATE INDEX "stack_permissions_organizationId_idx" ON "stack_permissions"("organizationId");

-- CreateIndex
CREATE INDEX "stack_permissions_userId_idx" ON "stack_permissions"("userId");

-- CreateIndex
CREATE INDEX "approval_workflows_stackId_idx" ON "approval_workflows"("stackId");

-- CreateIndex
CREATE INDEX "approval_workflows_organizationId_idx" ON "approval_workflows"("organizationId");

-- CreateIndex
CREATE INDEX "approval_workflows_type_idx" ON "approval_workflows"("type");

-- CreateIndex
CREATE INDEX "approval_workflows_status_idx" ON "approval_workflows"("status");

-- CreateIndex
CREATE INDEX "approval_workflows_createdById_idx" ON "approval_workflows"("createdById");

-- CreateIndex
CREATE INDEX "approval_workflows_assignedToId_idx" ON "approval_workflows"("assignedToId");

-- CreateIndex
CREATE INDEX "workflow_comments_workflowId_idx" ON "workflow_comments"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_comments_userId_idx" ON "workflow_comments"("userId");

-- CreateIndex
CREATE INDEX "workflow_comments_parentCommentId_idx" ON "workflow_comments"("parentCommentId");

-- CreateIndex
CREATE INDEX "organization_templates_organizationId_idx" ON "organization_templates"("organizationId");

-- CreateIndex
CREATE INDEX "organization_templates_createdById_idx" ON "organization_templates"("createdById");

-- CreateIndex
CREATE INDEX "organization_templates_visibility_idx" ON "organization_templates"("visibility");

-- CreateIndex
CREATE INDEX "organization_templates_category_idx" ON "organization_templates"("category");

-- CreateIndex
CREATE INDEX "organization_templates_isApproved_idx" ON "organization_templates"("isApproved");

-- CreateIndex
CREATE INDEX "organization_templates_parentTemplateId_idx" ON "organization_templates"("parentTemplateId");

-- CreateIndex
CREATE INDEX "organization_templates_usageCount_idx" ON "organization_templates"("usageCount");

-- CreateIndex
CREATE INDEX "organization_templates_rating_idx" ON "organization_templates"("rating");

-- CreateIndex
CREATE INDEX "organization_templates_createdAt_idx" ON "organization_templates"("createdAt");

-- CreateIndex
CREATE INDEX "organization_template_usage_templateId_idx" ON "organization_template_usage"("templateId");

-- CreateIndex
CREATE INDEX "organization_template_usage_organizationId_idx" ON "organization_template_usage"("organizationId");

-- CreateIndex
CREATE INDEX "organization_template_usage_userId_idx" ON "organization_template_usage"("userId");

-- CreateIndex
CREATE INDEX "organization_template_usage_stackId_idx" ON "organization_template_usage"("stackId");

-- CreateIndex
CREATE INDEX "organization_template_usage_createdAt_idx" ON "organization_template_usage"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_eventType_idx" ON "audit_logs"("eventType");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "vulnerability_scans_target_idx" ON "vulnerability_scans"("target");

-- CreateIndex
CREATE INDEX "vulnerability_scans_target_type_idx" ON "vulnerability_scans"("target_type");

-- CreateIndex
CREATE INDEX "vulnerability_scans_status_idx" ON "vulnerability_scans"("status");

-- CreateIndex
CREATE INDEX "vulnerability_scans_started_at_idx" ON "vulnerability_scans"("started_at" DESC);

-- CreateIndex
CREATE INDEX "vulnerability_scans_completed_at_idx" ON "vulnerability_scans"("completed_at" DESC);

-- CreateIndex
CREATE INDEX "vulnerabilities_scanId_idx" ON "vulnerabilities"("scanId");

-- CreateIndex
CREATE INDEX "vulnerabilities_vulnerabilityId_idx" ON "vulnerabilities"("vulnerabilityId");

-- CreateIndex
CREATE INDEX "vulnerabilities_severity_idx" ON "vulnerabilities"("severity");

-- CreateIndex
CREATE INDEX "vulnerabilities_packageName_idx" ON "vulnerabilities"("packageName");

-- CreateIndex
CREATE INDEX "vulnerabilities_cvssScore_idx" ON "vulnerabilities"("cvssScore" DESC);

-- CreateIndex
CREATE INDEX "vulnerabilities_publishedDate_idx" ON "vulnerabilities"("publishedDate" DESC);

-- CreateIndex
CREATE INDEX "security_misconfigurations_scanId_idx" ON "security_misconfigurations"("scanId");

-- CreateIndex
CREATE INDEX "security_misconfigurations_ruleId_idx" ON "security_misconfigurations"("ruleId");

-- CreateIndex
CREATE INDEX "security_misconfigurations_severity_idx" ON "security_misconfigurations"("severity");

-- CreateIndex
CREATE INDEX "security_misconfigurations_category_idx" ON "security_misconfigurations"("category");

-- CreateIndex
CREATE INDEX "security_scan_summaries_target_type_idx" ON "security_scan_summaries"("target_type");

-- CreateIndex
CREATE INDEX "security_scan_summaries_risk_level_idx" ON "security_scan_summaries"("risk_level");

-- CreateIndex
CREATE INDEX "security_scan_summaries_security_score_idx" ON "security_scan_summaries"("security_score" DESC);

-- CreateIndex
CREATE INDEX "security_scan_summaries_last_scan_date_idx" ON "security_scan_summaries"("last_scan_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "security_scan_summaries_target_target_type_key" ON "security_scan_summaries"("target", "target_type");

-- CreateIndex
CREATE INDEX "vulnerability_exceptions_vulnerabilityId_idx" ON "vulnerability_exceptions"("vulnerabilityId");

-- CreateIndex
CREATE INDEX "vulnerability_exceptions_exceptionType_idx" ON "vulnerability_exceptions"("exceptionType");

-- CreateIndex
CREATE INDEX "vulnerability_exceptions_expires_at_idx" ON "vulnerability_exceptions"("expires_at");

-- CreateIndex
CREATE INDEX "vulnerability_exceptions_approved_by_idx" ON "vulnerability_exceptions"("approved_by");

-- CreateIndex
CREATE UNIQUE INDEX "security_metrics_snapshots_date_key" ON "security_metrics_snapshots"("date");

-- CreateIndex
CREATE INDEX "security_metrics_snapshots_date_idx" ON "security_metrics_snapshots"("date" DESC);

-- CreateIndex
CREATE INDEX "security_metrics_snapshots_security_score_idx" ON "security_metrics_snapshots"("security_score");

-- CreateIndex
CREATE INDEX "trend_analysis_cache_period_idx" ON "trend_analysis_cache"("period");

-- CreateIndex
CREATE INDEX "trend_analysis_cache_valid_until_idx" ON "trend_analysis_cache"("valid_until");

-- CreateIndex
CREATE INDEX "trend_analysis_cache_confidence_score_idx" ON "trend_analysis_cache"("confidence_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "trend_analysis_cache_period_key" ON "trend_analysis_cache"("period");

-- CreateIndex
CREATE INDEX "security_anomalies_date_idx" ON "security_anomalies"("date" DESC);

-- CreateIndex
CREATE INDEX "security_anomalies_anomaly_type_idx" ON "security_anomalies"("anomaly_type");

-- CreateIndex
CREATE INDEX "security_anomalies_severity_idx" ON "security_anomalies"("severity");

-- CreateIndex
CREATE INDEX "security_anomalies_metric_type_idx" ON "security_anomalies"("metric_type");

-- CreateIndex
CREATE INDEX "security_anomalies_is_acknowledged_idx" ON "security_anomalies"("is_acknowledged");

-- CreateIndex
CREATE INDEX "security_anomalies_confidence_idx" ON "security_anomalies"("confidence" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "remediation_metrics_date_key" ON "remediation_metrics"("date");

-- CreateIndex
CREATE INDEX "remediation_metrics_date_idx" ON "remediation_metrics"("date" DESC);

-- CreateIndex
CREATE INDEX "remediation_metrics_fix_rate_percentage_idx" ON "remediation_metrics"("fix_rate_percentage" DESC);

-- CreateIndex
CREATE INDEX "remediation_metrics_mean_time_to_fix_hours_idx" ON "remediation_metrics"("mean_time_to_fix_hours");

-- CreateIndex
CREATE INDEX "security_forecasts_forecast_date_idx" ON "security_forecasts"("forecast_date" DESC);

-- CreateIndex
CREATE INDEX "security_forecasts_period_idx" ON "security_forecasts"("period");

-- CreateIndex
CREATE INDEX "security_forecasts_metric_type_idx" ON "security_forecasts"("metric_type");

-- CreateIndex
CREATE INDEX "security_forecasts_prediction_confidence_idx" ON "security_forecasts"("prediction_confidence" DESC);

-- CreateIndex
CREATE INDEX "security_seasonal_patterns_pattern_type_idx" ON "security_seasonal_patterns"("pattern_type");

-- CreateIndex
CREATE INDEX "security_seasonal_patterns_metric_type_idx" ON "security_seasonal_patterns"("metric_type");

-- CreateIndex
CREATE INDEX "security_seasonal_patterns_confidence_idx" ON "security_seasonal_patterns"("confidence" DESC);

-- CreateIndex
CREATE INDEX "security_seasonal_patterns_is_active_idx" ON "security_seasonal_patterns"("is_active");

-- CreateIndex
CREATE INDEX "security_trend_recommendations_recommendation_type_idx" ON "security_trend_recommendations"("recommendation_type");

-- CreateIndex
CREATE INDEX "security_trend_recommendations_priority_idx" ON "security_trend_recommendations"("priority");

-- CreateIndex
CREATE INDEX "security_trend_recommendations_status_idx" ON "security_trend_recommendations"("status");

-- CreateIndex
CREATE INDEX "security_trend_recommendations_confidence_score_idx" ON "security_trend_recommendations"("confidence_score" DESC);

-- CreateIndex
CREATE INDEX "security_trend_recommendations_created_at_idx" ON "security_trend_recommendations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "security_trend_recommendations_valid_until_idx" ON "security_trend_recommendations"("valid_until");

-- CreateIndex
CREATE INDEX "security_benchmarks_metric_type_idx" ON "security_benchmarks"("metric_type");

-- CreateIndex
CREATE INDEX "security_benchmarks_is_active_idx" ON "security_benchmarks"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "security_benchmarks_benchmark_name_metric_type_key" ON "security_benchmarks"("benchmark_name", "metric_type");

-- CreateIndex
CREATE UNIQUE INDEX "_TemplateServices_AB_unique" ON "_TemplateServices"("A", "B");

-- CreateIndex
CREATE INDEX "_TemplateServices_B_index" ON "_TemplateServices"("B");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_imports" ADD CONSTRAINT "service_imports_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stacks" ADD CONSTRAINT "stacks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stack_services" ADD CONSTRAINT "stack_services_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stack_services" ADD CONSTRAINT "stack_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stack_service_configurations" ADD CONSTRAINT "stack_service_configurations_stackServiceId_fkey" FOREIGN KEY ("stackServiceId") REFERENCES "stack_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_usage" ADD CONSTRAINT "template_usage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "use_case_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_ratings" ADD CONSTRAINT "template_ratings_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "use_case_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "use_case_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_target_overrides" ADD CONSTRAINT "deployment_target_overrides_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "deployment_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_target_overrides" ADD CONSTRAINT "deployment_target_overrides_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_artifacts" ADD CONSTRAINT "deployment_artifacts_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_artifacts" ADD CONSTRAINT "deployment_artifacts_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "deployment_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_jobs" ADD CONSTRAINT "deployment_jobs_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_jobs" ADD CONSTRAINT "deployment_jobs_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "deployment_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployment_jobs" ADD CONSTRAINT "deployment_jobs_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "deployment_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_metrics" ADD CONSTRAINT "custom_metrics_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_metrics" ADD CONSTRAINT "custom_metrics_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_events" ADD CONSTRAINT "log_events_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_events" ADD CONSTRAINT "log_events_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_baselines" ADD CONSTRAINT "performance_baselines_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_baselines" ADD CONSTRAINT "performance_baselines_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_recommendations" ADD CONSTRAINT "optimization_recommendations_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optimization_recommendations" ADD CONSTRAINT "optimization_recommendations_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_alerts" ADD CONSTRAINT "performance_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_alerts" ADD CONSTRAINT "performance_alerts_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_alerts" ADD CONSTRAINT "performance_alerts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "performance_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_analysis" ADD CONSTRAINT "cost_analysis_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_analysis" ADD CONSTRAINT "cost_analysis_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scaling_policies" ADD CONSTRAINT "scaling_policies_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scaling_policies" ADD CONSTRAINT "scaling_policies_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_scaling_configs" ADD CONSTRAINT "auto_scaling_configs_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_scaling_configs" ADD CONSTRAINT "auto_scaling_configs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_scaling_events" ADD CONSTRAINT "auto_scaling_events_configId_fkey" FOREIGN KEY ("configId") REFERENCES "auto_scaling_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_scaling_events" ADD CONSTRAINT "auto_scaling_events_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "scaling_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_scaling_events" ADD CONSTRAINT "auto_scaling_events_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_scaling_events" ADD CONSTRAINT "auto_scaling_events_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_policies" ADD CONSTRAINT "escalation_policies_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_models" ADD CONSTRAINT "ml_models_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_models" ADD CONSTRAINT "ml_models_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_currentOrganizationId_fkey" FOREIGN KEY ("currentOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stack_permissions" ADD CONSTRAINT "stack_permissions_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stack_permissions" ADD CONSTRAINT "stack_permissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stack_permissions" ADD CONSTRAINT "stack_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stack_permissions" ADD CONSTRAINT "stack_permissions_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_comments" ADD CONSTRAINT "workflow_comments_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_comments" ADD CONSTRAINT "workflow_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_comments" ADD CONSTRAINT "workflow_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "workflow_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_templates" ADD CONSTRAINT "organization_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_templates" ADD CONSTRAINT "organization_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_templates" ADD CONSTRAINT "organization_templates_parentTemplateId_fkey" FOREIGN KEY ("parentTemplateId") REFERENCES "organization_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_templates" ADD CONSTRAINT "organization_templates_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "approval_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_template_usage" ADD CONSTRAINT "organization_template_usage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "organization_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_template_usage" ADD CONSTRAINT "organization_template_usage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_template_usage" ADD CONSTRAINT "organization_template_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "vulnerability_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_misconfigurations" ADD CONSTRAINT "security_misconfigurations_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "vulnerability_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TemplateServices" ADD CONSTRAINT "_TemplateServices_A_fkey" FOREIGN KEY ("A") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TemplateServices" ADD CONSTRAINT "_TemplateServices_B_fkey" FOREIGN KEY ("B") REFERENCES "use_case_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
