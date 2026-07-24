-- CreateTable
CREATE TABLE "frameworks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT DEFAULT 'v1',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controls" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "severity" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_mappings" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "ruleId" TEXT,
    "matcher" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "control_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "definition" TEXT NOT NULL,
    "defaultParameters" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateId" TEXT,
    "parameters" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "enforcementLevel" TEXT NOT NULL DEFAULT 'enforce',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_exceptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "policyId" TEXT NOT NULL,
    "stackId" TEXT,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3),
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "scanId" TEXT,
    "scanType" TEXT,
    "vulnerabilityRefId" TEXT,
    "misconfigurationRefId" TEXT,
    "controlId" TEXT,
    "severity" TEXT NOT NULL,
    "category" TEXT,
    "resource" TEXT,
    "cve" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "stackId" TEXT,
    "controlId" TEXT,
    "scanId" TEXT,
    "type" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "storageProvider" TEXT DEFAULT 'local',
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_exports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedBy" TEXT,
    "format" TEXT NOT NULL,
    "filters" TEXT NOT NULL DEFAULT '{}',
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remediation_actions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetType" TEXT NOT NULL,
    "parametersSchema" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remediation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remediation_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "stackId" TEXT,
    "actionId" TEXT NOT NULL,
    "targetRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "diff" TEXT,
    "rollbackToken" TEXT,
    "windowDays" INTEGER NOT NULL DEFAULT 7,
    "logs" TEXT NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remediation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_approvals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "stackId" TEXT,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "frameworks_key_key" ON "frameworks"("key");

-- CreateIndex
CREATE INDEX "frameworks_key_idx" ON "frameworks"("key");

-- CreateIndex
CREATE INDEX "frameworks_name_idx" ON "frameworks"("name");

-- CreateIndex
CREATE INDEX "controls_frameworkId_idx" ON "controls"("frameworkId");

-- CreateIndex
CREATE INDEX "controls_category_idx" ON "controls"("category");

-- CreateIndex
CREATE INDEX "controls_severity_idx" ON "controls"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "controls_frameworkId_controlId_key" ON "controls"("frameworkId", "controlId");

-- CreateIndex
CREATE INDEX "control_mappings_controlId_idx" ON "control_mappings"("controlId");

-- CreateIndex
CREATE INDEX "control_mappings_ruleType_idx" ON "control_mappings"("ruleType");

-- CreateIndex
CREATE INDEX "control_mappings_ruleId_idx" ON "control_mappings"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_templates_key_key" ON "policy_templates"("key");

-- CreateIndex
CREATE INDEX "policy_templates_key_idx" ON "policy_templates"("key");

-- CreateIndex
CREATE INDEX "policies_organizationId_idx" ON "policies"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "policies_organizationId_key_key" ON "policies"("organizationId", "key");

-- CreateIndex
CREATE INDEX "policy_exceptions_organizationId_idx" ON "policy_exceptions"("organizationId");

-- CreateIndex
CREATE INDEX "policy_exceptions_policyId_idx" ON "policy_exceptions"("policyId");

-- CreateIndex
CREATE INDEX "policy_exceptions_stackId_idx" ON "policy_exceptions"("stackId");

-- CreateIndex
CREATE INDEX "policy_exceptions_status_idx" ON "policy_exceptions"("status");

-- CreateIndex
CREATE INDEX "policy_exceptions_expiresAt_idx" ON "policy_exceptions"("expiresAt");

-- CreateIndex
CREATE INDEX "findings_scanId_idx" ON "findings"("scanId");

-- CreateIndex
CREATE INDEX "findings_severity_idx" ON "findings"("severity");

-- CreateIndex
CREATE INDEX "findings_controlId_idx" ON "findings"("controlId");

-- CreateIndex
CREATE INDEX "findings_cve_idx" ON "findings"("cve");

-- CreateIndex
CREATE INDEX "evidence_organizationId_idx" ON "evidence"("organizationId");

-- CreateIndex
CREATE INDEX "evidence_stackId_idx" ON "evidence"("stackId");

-- CreateIndex
CREATE INDEX "evidence_controlId_idx" ON "evidence"("controlId");

-- CreateIndex
CREATE INDEX "evidence_scanId_idx" ON "evidence"("scanId");

-- CreateIndex
CREATE INDEX "evidence_retentionDays_idx" ON "evidence"("retentionDays");

-- CreateIndex
CREATE INDEX "compliance_exports_organizationId_idx" ON "compliance_exports"("organizationId");

-- CreateIndex
CREATE INDEX "compliance_exports_format_idx" ON "compliance_exports"("format");

-- CreateIndex
CREATE INDEX "compliance_exports_status_idx" ON "compliance_exports"("status");

-- CreateIndex
CREATE INDEX "compliance_exports_createdAt_idx" ON "compliance_exports"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "remediation_actions_key_key" ON "remediation_actions"("key");

-- CreateIndex
CREATE INDEX "remediation_actions_key_idx" ON "remediation_actions"("key");

-- CreateIndex
CREATE INDEX "remediation_runs_organizationId_idx" ON "remediation_runs"("organizationId");

-- CreateIndex
CREATE INDEX "remediation_runs_stackId_idx" ON "remediation_runs"("stackId");

-- CreateIndex
CREATE INDEX "remediation_runs_actionId_idx" ON "remediation_runs"("actionId");

-- CreateIndex
CREATE INDEX "remediation_runs_status_idx" ON "remediation_runs"("status");

-- CreateIndex
CREATE INDEX "remediation_runs_createdAt_idx" ON "remediation_runs"("createdAt");

-- CreateIndex
CREATE INDEX "security_approvals_organizationId_idx" ON "security_approvals"("organizationId");

-- CreateIndex
CREATE INDEX "security_approvals_stackId_idx" ON "security_approvals"("stackId");

-- CreateIndex
CREATE INDEX "security_approvals_type_idx" ON "security_approvals"("type");

-- CreateIndex
CREATE INDEX "security_approvals_status_idx" ON "security_approvals"("status");

-- AddForeignKey
ALTER TABLE "controls" ADD CONSTRAINT "controls_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_mappings" ADD CONSTRAINT "control_mappings_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "policy_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_exceptions" ADD CONSTRAINT "policy_exceptions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_exceptions" ADD CONSTRAINT "policy_exceptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_exceptions" ADD CONSTRAINT "policy_exceptions_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "vulnerability_scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "vulnerability_scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_exports" ADD CONSTRAINT "compliance_exports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_runs" ADD CONSTRAINT "remediation_runs_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "remediation_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_runs" ADD CONSTRAINT "remediation_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_runs" ADD CONSTRAINT "remediation_runs_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_approvals" ADD CONSTRAINT "security_approvals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_approvals" ADD CONSTRAINT "security_approvals_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "stacks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
