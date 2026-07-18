import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';

test.describe('Export to Kubernetes Wizard', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto('/stacks/build');
    
    // Build a sample stack first
    await page.click('[data-testid="service-card-postgresql"]');
    await page.click('[data-testid="service-card-redis"]');
    await page.click('[data-testid="service-card-nginx"]');
  });

  test.describe('Export Flow', () => {
    test('should export stack as YAML', async () => {
      // Open export wizard
      await page.click('[data-testid="export-to-k8s-button"]');
      
      // Should show wizard modal
      await expect(page.locator('[data-testid="export-wizard-modal"]')).toBeVisible();
      
      // Step 1: Select export type
      await expect(page.locator('h2')).toContainText('Export to Kubernetes');
      await page.click('[data-testid="export-type-yaml"]');
      await page.click('[data-testid="wizard-next"]');
      
      // Step 2: Configure services
      await expect(page.locator('h3')).toContainText('Service Configuration');
      
      // Check all services are listed
      await expect(page.locator('[data-testid="service-config-postgresql"]')).toBeVisible();
      await expect(page.locator('[data-testid="service-config-redis"]')).toBeVisible();
      await expect(page.locator('[data-testid="service-config-nginx"]')).toBeVisible();
      
      // Configure PostgreSQL
      await page.click('[data-testid="service-config-postgresql"] [data-testid="expand-config"]');
      await page.fill('[data-testid="postgres-memory-limit"]', '2Gi');
      await page.fill('[data-testid="postgres-cpu-limit"]', '2');
      
      await page.click('[data-testid="wizard-next"]');
      
      // Step 3: Preview
      await expect(page.locator('h3')).toContainText('Preview');
      await expect(page.locator('[data-testid="yaml-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="yaml-preview"]')).toContainText('apiVersion: v1');
      await expect(page.locator('[data-testid="yaml-preview"]')).toContainText('kind: Service');
      
      // Download
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-yaml"]');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/stack-.*\.yaml$/);
    });

    test('should export stack as Helm chart', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      // Select Helm
      await page.click('[data-testid="export-type-helm"]');
      await page.click('[data-testid="wizard-next"]');
      
      // Configure services with Helm values
      await page.click('[data-testid="service-config-postgresql"] [data-testid="expand-config"]');
      await page.check('[data-testid="postgres-enable-persistence"]');
      await page.fill('[data-testid="postgres-storage-size"]', '10Gi');
      await page.click('[data-testid="wizard-next"]');
      
      // Helm-specific configuration
      await expect(page.locator('h3')).toContainText('Helm Configuration');
      await page.fill('[data-testid="helm-chart-name"]', 'my-stack');
      await page.fill('[data-testid="helm-chart-version"]', '1.0.0');
      await page.click('[data-testid="wizard-next"]');
      
      // Preview should show Helm structure
      await expect(page.locator('[data-testid="helm-preview"]')).toContainText('Chart.yaml');
      await expect(page.locator('[data-testid="helm-preview"]')).toContainText('values.yaml');
      await expect(page.locator('[data-testid="helm-preview"]')).toContainText('templates/');
      
      // Download as tar.gz
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-helm"]');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/.*\.tar\.gz$/);
    });

    test('should export stack as Kustomize', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      // Select Kustomize
      await page.click('[data-testid="export-type-kustomize"]');
      await page.click('[data-testid="wizard-next"]');
      
      // Configure base
      await page.click('[data-testid="wizard-next"]');
      
      // Configure overlays
      await expect(page.locator('h3')).toContainText('Environment Overlays');
      await page.check('[data-testid="overlay-development"]');
      await page.check('[data-testid="overlay-production"]');
      
      // Configure production overlay
      await page.click('[data-testid="configure-overlay-production"]');
      await page.fill('[data-testid="production-replicas"]', '3');
      await page.fill('[data-testid="production-domain"]', 'prod.example.com');
      
      await page.click('[data-testid="wizard-next"]');
      
      // Preview should show Kustomize structure
      await expect(page.locator('[data-testid="kustomize-preview"]')).toContainText('base/kustomization.yaml');
      await expect(page.locator('[data-testid="kustomize-preview"]')).toContainText('overlays/development/');
      await expect(page.locator('[data-testid="kustomize-preview"]')).toContainText('overlays/production/');
      
      // Download
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-kustomize"]');
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/kustomize-.*\.tar\.gz$/);
    });
  });

  test.describe('Direct Apply Flow', () => {
    test('should perform direct apply to cluster', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      // Select Direct Apply
      await page.click('[data-testid="export-action-apply"]');
      await page.click('[data-testid="wizard-next"]');
      
      // Select or create target
      await expect(page.locator('h3')).toContainText('Select Target');
      
      // Create new target
      await page.click('[data-testid="create-new-target"]');
      await page.fill('[data-testid="target-name"]', 'Test Cluster');
      await page.selectOption('[data-testid="target-provider"]', 'self-managed');
      
      // Upload kubeconfig
      await page.setInputFiles('[data-testid="kubeconfig-upload"]', 'fixtures/test-kubeconfig.yaml');
      await page.click('[data-testid="save-target"]');
      
      // Configure services for deployment
      await page.click('[data-testid="wizard-next"]');
      
      // Review deployment
      await expect(page.locator('h3')).toContainText('Review Deployment');
      await expect(page.locator('[data-testid="deployment-summary"]')).toContainText('3 services');
      await expect(page.locator('[data-testid="deployment-summary"]')).toContainText('Test Cluster');
      
      // Start deployment
      await page.click('[data-testid="start-deployment"]');
      
      // Should show job progress
      await expect(page.locator('[data-testid="job-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="job-status"]')).toContainText('pending', { timeout: 5000 });
      
      // Mock successful deployment
      await page.evaluate(() => {
        window.postMessage({ type: 'MOCK_DEPLOYMENT_SUCCESS' }, '*');
      });
      
      await expect(page.locator('[data-testid="job-status"]')).toContainText('completed', { timeout: 10000 });
      await expect(page.locator('[data-testid="deployment-success"]')).toBeVisible();
    });

    test('should handle deployment errors', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      // Quick path to deployment
      await page.click('[data-testid="export-action-apply"]');
      await page.click('[data-testid="wizard-next"]');
      
      // Use existing target
      await page.selectOption('[data-testid="target-select"]', 'existing-target-1');
      await page.click('[data-testid="wizard-next"]');
      await page.click('[data-testid="wizard-next"]'); // Skip config
      
      // Start deployment
      await page.click('[data-testid="start-deployment"]');
      
      // Mock deployment error
      await page.evaluate(() => {
        window.postMessage({ 
          type: 'MOCK_DEPLOYMENT_ERROR',
          error: 'Failed to connect to cluster'
        }, '*');
      });
      
      await expect(page.locator('[data-testid="job-status"]')).toContainText('failed', { timeout: 10000 });
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to connect to cluster');
      
      // Should show retry option
      await expect(page.locator('[data-testid="retry-deployment"]')).toBeVisible();
    });
  });

  test.describe('Service Overrides', () => {
    test('should configure per-service overrides', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      await page.click('[data-testid="export-type-yaml"]');
      await page.click('[data-testid="wizard-next"]');
      
      // PostgreSQL overrides
      await page.click('[data-testid="service-config-postgresql"] [data-testid="expand-config"]');
      
      // Environment variables to Secrets
      await page.click('[data-testid="postgres-env-type"]');
      await page.selectOption('[data-testid="postgres-env-type"]', 'secret');
      await page.fill('[data-testid="postgres-secret-name"]', 'postgres-credentials');
      
      // Resources
      await page.fill('[data-testid="postgres-memory-request"]', '512Mi');
      await page.fill('[data-testid="postgres-memory-limit"]', '2Gi');
      await page.fill('[data-testid="postgres-cpu-request"]', '500m');
      await page.fill('[data-testid="postgres-cpu-limit"]', '2');
      
      // Health probes
      await page.check('[data-testid="postgres-enable-liveness"]');
      await page.fill('[data-testid="postgres-liveness-initial-delay"]', '30');
      await page.fill('[data-testid="postgres-liveness-period"]', '10');
      
      await page.check('[data-testid="postgres-enable-readiness"]');
      await page.fill('[data-testid="postgres-readiness-initial-delay"]', '5');
      await page.fill('[data-testid="postgres-readiness-period"]', '5');
      
      // Storage
      await page.check('[data-testid="postgres-enable-pvc"]');
      await page.fill('[data-testid="postgres-pvc-size"]', '20Gi');
      await page.selectOption('[data-testid="postgres-storage-class"]', 'fast-ssd');
      
      // Ingress for nginx
      await page.click('[data-testid="service-config-nginx"] [data-testid="expand-config"]');
      await page.check('[data-testid="nginx-enable-ingress"]');
      await page.fill('[data-testid="nginx-ingress-host"]', 'app.example.com');
      await page.check('[data-testid="nginx-ingress-tls"]');
      await page.fill('[data-testid="nginx-tls-secret"]', 'app-tls');
      
      // Advanced annotations
      await page.click('[data-testid="nginx-advanced-toggle"]');
      await page.click('[data-testid="add-annotation"]');
      await page.fill('[data-testid="annotation-key-0"]', 'nginx.ingress.kubernetes.io/ssl-redirect');
      await page.fill('[data-testid="annotation-value-0"]', 'true');
      
      await page.click('[data-testid="wizard-next"]');
      
      // Verify preview contains overrides
      const preview = page.locator('[data-testid="yaml-preview"]');
      await expect(preview).toContainText('postgres-credentials');
      await expect(preview).toContainText('memory: 2Gi');
      await expect(preview).toContainText('livenessProbe');
      await expect(preview).toContainText('readinessProbe');
      await expect(preview).toContainText('persistentVolumeClaim');
      await expect(preview).toContainText('fast-ssd');
      await expect(preview).toContainText('app.example.com');
      await expect(preview).toContainText('ssl-redirect');
    });

    test('should validate override inputs', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      await page.click('[data-testid="export-type-yaml"]');
      await page.click('[data-testid="wizard-next"]');
      
      await page.click('[data-testid="service-config-postgresql"] [data-testid="expand-config"]');
      
      // Invalid resource values
      await page.fill('[data-testid="postgres-memory-limit"]', 'invalid');
      await page.blur('[data-testid="postgres-memory-limit"]');
      await expect(page.locator('[data-testid="postgres-memory-limit-error"]')).toContainText('Invalid memory format');
      
      await page.fill('[data-testid="postgres-cpu-limit"]', '-1');
      await page.blur('[data-testid="postgres-cpu-limit"]');
      await expect(page.locator('[data-testid="postgres-cpu-limit-error"]')).toContainText('Must be positive');
      
      // Invalid probe values
      await page.check('[data-testid="postgres-enable-liveness"]');
      await page.fill('[data-testid="postgres-liveness-initial-delay"]', '0');
      await expect(page.locator('[data-testid="postgres-liveness-initial-delay-error"]')).toContainText('Must be at least 1');
      
      // Should not allow proceeding with errors
      await expect(page.locator('[data-testid="wizard-next"]')).toBeDisabled();
      
      // Fix errors
      await page.fill('[data-testid="postgres-memory-limit"]', '2Gi');
      await page.fill('[data-testid="postgres-cpu-limit"]', '2');
      await page.fill('[data-testid="postgres-liveness-initial-delay"]', '30');
      
      // Should allow proceeding
      await expect(page.locator('[data-testid="wizard-next"]')).toBeEnabled();
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      // Tab through export type options
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="export-type-yaml"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="export-type-helm"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="export-type-kustomize"]')).toBeFocused();
      
      // Select with Space/Enter
      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="export-type-kustomize"]')).toBeChecked();
      
      // Navigate to next button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="wizard-next"]')).toBeFocused();
      
      await page.keyboard.press('Enter');
      
      // Should advance to next step
      await expect(page.locator('h3')).toContainText('Service Configuration');
    });

    test('should have proper ARIA labels', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      // Check modal accessibility
      const modal = page.locator('[data-testid="export-wizard-modal"]');
      await expect(modal).toHaveAttribute('role', 'dialog');
      await expect(modal).toHaveAttribute('aria-label', 'Export to Kubernetes Wizard');
      
      // Check form controls
      const yamlOption = page.locator('[data-testid="export-type-yaml"]');
      await expect(yamlOption).toHaveAttribute('role', 'radio');
      await expect(yamlOption).toHaveAttribute('aria-label', 'Export as YAML');
      
      // Check navigation
      const nextButton = page.locator('[data-testid="wizard-next"]');
      await expect(nextButton).toHaveAttribute('aria-label', 'Next step');
      
      const prevButton = page.locator('[data-testid="wizard-prev"]');
      await expect(prevButton).toHaveAttribute('aria-label', 'Previous step');
      
      // Check progress indicator
      const progress = page.locator('[data-testid="wizard-progress"]');
      await expect(progress).toHaveAttribute('role', 'progressbar');
      await expect(progress).toHaveAttribute('aria-valuenow', '1');
      await expect(progress).toHaveAttribute('aria-valuemax', '3');
    });

    test('should announce changes for screen readers', async () => {
      await page.click('[data-testid="export-to-k8s-button"]');
      
      // Check for live regions
      const liveRegion = page.locator('[aria-live="polite"]');
      await expect(liveRegion).toBeAttached();
      
      // Advance wizard
      await page.click('[data-testid="export-type-yaml"]');
      await page.click('[data-testid="wizard-next"]');
      
      // Check announcement
      await expect(liveRegion).toContainText('Step 2 of 3: Service Configuration');
      
      // Trigger validation error
      await page.click('[data-testid="service-config-postgresql"] [data-testid="expand-config"]');
      await page.fill('[data-testid="postgres-memory-limit"]', 'invalid');
      await page.blur('[data-testid="postgres-memory-limit"]');
      
      // Check error announcement
      await expect(liveRegion).toContainText('Error: Invalid memory format');
    });
  });

  test.describe('i18n Support', () => {
    test('should support multiple languages', async () => {
      // Switch to German
      await page.selectOption('[data-testid="language-selector"]', 'de');
      await page.click('[data-testid="export-to-k8s-button"]');
      
      await expect(page.locator('h2')).toContainText('Nach Kubernetes exportieren');
      await expect(page.locator('[data-testid="export-type-yaml"] + label')).toContainText('Als YAML exportieren');
      await expect(page.locator('[data-testid="wizard-next"]')).toContainText('Weiter');
      
      // Switch to Spanish
      await page.selectOption('[data-testid="language-selector"]', 'es');
      await page.reload();
      await page.click('[data-testid="export-to-k8s-button"]');
      
      await expect(page.locator('h2')).toContainText('Exportar a Kubernetes');
      await expect(page.locator('[data-testid="export-type-yaml"] + label')).toContainText('Exportar como YAML');
      await expect(page.locator('[data-testid="wizard-next"]')).toContainText('Siguiente');
    });
  });
});