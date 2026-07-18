#!/bin/bash

# Deployment Health Monitoring Dashboard
# Creates comprehensive dashboard showing deployment status, system health, and performance metrics
# Usage: ./health-dashboard.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DASHBOARD_DIR="$PROJECT_DIR/dashboard"
REPORTS_DIR="$PROJECT_DIR/reports"
WEB_DIR="$DASHBOARD_DIR/web"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Dashboard configuration
DASHBOARD_PORT="${DASHBOARD_PORT:-8080}"
UPDATE_INTERVAL="${UPDATE_INTERVAL:-30}" # seconds
ENVIRONMENT="${ENVIRONMENT:-production}"
NAMESPACE="${NAMESPACE:-buildmystack-prod}"

# Initialize dashboard
init_dashboard() {
    echo -e "${BOLD}${BLUE}=== BuildMyStack Health Dashboard ===${NC}"
    echo -e "${CYAN}Port: $DASHBOARD_PORT${NC}"
    echo -e "${CYAN}Environment: $ENVIRONMENT${NC}"
    echo -e "${CYAN}Update Interval: ${UPDATE_INTERVAL}s${NC}"
    echo

    # Create necessary directories
    mkdir -p "$WEB_DIR/assets/css" "$WEB_DIR/assets/js" "$WEB_DIR/api"
    
    # Create dashboard files
    create_dashboard_html
    create_dashboard_css
    create_dashboard_js
    create_api_endpoints
}

# Create main dashboard HTML
create_dashboard_html() {
    cat > "$WEB_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BuildMyStack - Health Dashboard</title>
    <link rel="stylesheet" href="assets/css/dashboard.css">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23667eea'%3E%3Cpath d='M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z'/%3E%3C/svg%3E">
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="container">
            <h1 class="logo">
                <span class="icon">🛡️</span>
                BuildMyStack Health Dashboard
            </h1>
            <div class="header-info">
                <span class="environment" id="environment">{{ENVIRONMENT}}</span>
                <span class="last-updated">Last updated: <span id="lastUpdated">--:--</span></span>
                <div class="status-indicator" id="overallStatus">
                    <span class="status-dot"></span>
                    <span class="status-text">Checking...</span>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="main">
        <div class="container">
            
            <!-- Quick Stats -->
            <section class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-content">
                        <div class="stat-value" id="totalUsers">--</div>
                        <div class="stat-label">Total Users</div>
                        <div class="stat-change" id="userChange">--</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-content">
                        <div class="stat-value" id="activeUsers">--</div>
                        <div class="stat-label">Daily Active Users</div>
                        <div class="stat-change" id="dauChange">--</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎯</div>
                    <div class="stat-content">
                        <div class="stat-value" id="recommendations">--</div>
                        <div class="stat-label">Recommendations</div>
                        <div class="stat-change" id="recChange">--</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⚡</div>
                    <div class="stat-content">
                        <div class="stat-value" id="responseTime">--ms</div>
                        <div class="stat-label">Avg Response Time</div>
                        <div class="stat-change" id="responseChange">--</div>
                    </div>
                </div>
            </section>

            <!-- Main Dashboard Grid -->
            <div class="dashboard-grid">
                
                <!-- System Health -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <h2>System Health</h2>
                        <div class="card-actions">
                            <button class="refresh-btn" onclick="refreshSystemHealth()">🔄</button>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="health-grid">
                            <div class="health-item" id="apiHealth">
                                <div class="health-status"></div>
                                <span class="health-label">API</span>
                                <span class="health-value">--</span>
                            </div>
                            <div class="health-item" id="dbHealth">
                                <div class="health-status"></div>
                                <span class="health-label">Database</span>
                                <span class="health-value">--</span>
                            </div>
                            <div class="health-item" id="redisHealth">
                                <div class="health-status"></div>
                                <span class="health-label">Redis</span>
                                <span class="health-value">--</span>
                            </div>
                            <div class="health-item" id="k8sHealth">
                                <div class="health-status"></div>
                                <span class="health-label">Kubernetes</span>
                                <span class="health-value">--</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Performance Metrics -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <h2>Performance Metrics</h2>
                    </div>
                    <div class="card-content">
                        <canvas id="performanceChart" width="400" height="200"></canvas>
                    </div>
                </div>

                <!-- Deployment Status -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <h2>Deployment Status</h2>
                    </div>
                    <div class="card-content">
                        <div class="deployment-info">
                            <div class="deployment-item">
                                <span class="label">Current Version:</span>
                                <span class="value" id="currentVersion">--</span>
                            </div>
                            <div class="deployment-item">
                                <span class="label">Last Deployment:</span>
                                <span class="value" id="lastDeployment">--</span>
                            </div>
                            <div class="deployment-item">
                                <span class="label">Deployment Status:</span>
                                <span class="status" id="deploymentStatus">--</span>
                            </div>
                            <div class="deployment-item">
                                <span class="label">Feature Flags:</span>
                                <div class="feature-flags" id="featureFlags">
                                    <span class="flag">AI: <span id="aiFlagStatus">--%</span></span>
                                    <span class="flag">Templates: <span id="templatesFlagStatus">--%</span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Resource Usage -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <h2>Resource Usage</h2>
                    </div>
                    <div class="card-content">
                        <div class="resource-grid">
                            <div class="resource-item">
                                <div class="resource-label">CPU Usage</div>
                                <div class="progress-bar">
                                    <div class="progress-fill" id="cpuProgress" style="width: 0%"></div>
                                </div>
                                <div class="resource-value" id="cpuValue">0%</div>
                            </div>
                            <div class="resource-item">
                                <div class="resource-label">Memory Usage</div>
                                <div class="progress-bar">
                                    <div class="progress-fill" id="memoryProgress" style="width: 0%"></div>
                                </div>
                                <div class="resource-value" id="memoryValue">0%</div>
                            </div>
                            <div class="resource-item">
                                <div class="resource-label">Disk Usage</div>
                                <div class="progress-bar">
                                    <div class="progress-fill" id="diskProgress" style="width: 0%"></div>
                                </div>
                                <div class="resource-value" id="diskValue">0%</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recent Alerts -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <h2>Recent Alerts</h2>
                    </div>
                    <div class="card-content">
                        <div class="alerts-list" id="alertsList">
                            <div class="no-alerts">No recent alerts</div>
                        </div>
                    </div>
                </div>

                <!-- Pod Status -->
                <div class="dashboard-card">
                    <div class="card-header">
                        <h2>Pod Status</h2>
                    </div>
                    <div class="card-content">
                        <div class="pod-grid" id="podGrid">
                            <div class="loading">Loading pod information...</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </main>

    <script src="assets/js/dashboard.js"></script>
</body>
</html>
EOF

    # Replace environment placeholder
    sed -i '' "s/{{ENVIRONMENT}}/$ENVIRONMENT/g" "$WEB_DIR/index.html" 2>/dev/null || \
    sed -i "s/{{ENVIRONMENT}}/$ENVIRONMENT/g" "$WEB_DIR/index.html"
}

# Create dashboard CSS
create_dashboard_css() {
    cat > "$WEB_DIR/assets/css/dashboard.css" << 'EOF'
/* Dashboard Styles */
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
    --info-color: #3b82f6;
    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #f1f5f9;
    --text-primary: #1e293b;
    --text-secondary: #64748b;
    --border-color: #e2e8f0;
    --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    line-height: 1.6;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 1rem;
}

/* Header */
.header {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
    color: white;
    padding: 1rem 0;
    box-shadow: var(--shadow-lg);
}

.header .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
}

.logo {
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.header-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.environment {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
}

.last-updated {
    font-size: 0.875rem;
    opacity: 0.9;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success-color);
    animation: pulse 2s infinite;
}

.status-dot.warning {
    background: var(--warning-color);
}

.status-dot.danger {
    background: var(--danger-color);
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Main Content */
.main {
    padding: 2rem 0;
}

/* Stats Grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
}

.stat-card {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.stat-icon {
    font-size: 2rem;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    border-radius: 0.75rem;
    color: white;
}

.stat-content {
    flex: 1;
}

.stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
}

.stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
}

.stat-change {
    font-size: 0.75rem;
    margin-top: 0.25rem;
    font-weight: 600;
}

.stat-change.positive {
    color: var(--success-color);
}

.stat-change.negative {
    color: var(--danger-color);
}

/* Dashboard Grid */
.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
}

.dashboard-card {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
}

.dashboard-card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
}

.card-header {
    padding: 1.5rem 1.5rem 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.card-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
}

.card-actions {
    display: flex;
    gap: 0.5rem;
}

.refresh-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    transition: background-color 0.2s;
}

.refresh-btn:hover {
    background-color: var(--bg-tertiary);
}

.card-content {
    padding: 1.5rem;
}

/* Health Grid */
.health-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

.health-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
}

.health-status {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--text-secondary);
}

.health-status.healthy {
    background: var(--success-color);
}

.health-status.warning {
    background: var(--warning-color);
}

.health-status.error {
    background: var(--danger-color);
}

.health-label {
    font-weight: 600;
    color: var(--text-primary);
}

.health-value {
    margin-left: auto;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

/* Performance Chart */
#performanceChart {
    width: 100% !important;
    height: auto !important;
    max-height: 200px;
}

/* Deployment Info */
.deployment-info {
    space-y: 1rem;
}

.deployment-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color);
}

.deployment-item:last-child {
    border-bottom: none;
}

.deployment-item .label {
    font-weight: 600;
    color: var(--text-primary);
}

.deployment-item .value {
    color: var(--text-secondary);
}

.deployment-item .status {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--bg-secondary);
    color: var(--text-secondary);
}

.deployment-item .status.healthy {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
}

.deployment-item .status.warning {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.deployment-item .status.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.feature-flags {
    display: flex;
    gap: 1rem;
}

.flag {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

/* Resource Usage */
.resource-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.resource-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.resource-label {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
}

.progress-bar {
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 1rem;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--success-color), var(--warning-color));
    border-radius: 1rem;
    transition: width 0.3s ease;
}

.progress-fill.warning {
    background: var(--warning-color);
}

.progress-fill.danger {
    background: var(--danger-color);
}

.resource-value {
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-align: right;
}

/* Alerts */
.alerts-list {
    max-height: 300px;
    overflow-y: auto;
}

.alert-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border-left: 4px solid var(--info-color);
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
}

.alert-item:last-child {
    margin-bottom: 0;
}

.alert-item.warning {
    border-left-color: var(--warning-color);
}

.alert-item.error {
    border-left-color: var(--danger-color);
}

.alert-icon {
    font-size: 1.25rem;
}

.alert-content {
    flex: 1;
}

.alert-title {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
}

.alert-message {
    color: var(--text-secondary);
    font-size: 0.75rem;
    margin-top: 0.25rem;
}

.alert-time {
    font-size: 0.75rem;
    color: var(--text-secondary);
    white-space: nowrap;
}

.no-alerts {
    text-align: center;
    color: var(--text-secondary);
    padding: 2rem;
    font-style: italic;
}

/* Pod Grid */
.pod-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
}

.pod-item {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    padding: 1rem;
    text-align: center;
    position: relative;
}

.pod-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
}

.pod-status {
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-weight: 600;
    display: inline-block;
}

.pod-status.running {
    background: rgba(16, 185, 129, 0.1);
    color: var(--success-color);
}

.pod-status.pending {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.pod-status.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger-color);
}

.loading {
    text-align: center;
    color: var(--text-secondary);
    padding: 2rem;
    font-style: italic;
}

/* Responsive Design */
@media (max-width: 768px) {
    .header .container {
        flex-direction: column;
        text-align: center;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
    
    .health-grid {
        grid-template-columns: 1fr;
    }
    
    .feature-flags {
        flex-direction: column;
        gap: 0.5rem;
    }
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
    :root {
        --bg-primary: #1e293b;
        --bg-secondary: #0f172a;
        --bg-tertiary: #334155;
        --text-primary: #f1f5f9;
        --text-secondary: #94a3b8;
        --border-color: #334155;
    }
    
    .stat-card, .dashboard-card {
        border: 1px solid var(--border-color);
    }
    
    .health-item {
        background: var(--bg-tertiary);
    }
}
EOF
}

# Create dashboard JavaScript
create_dashboard_js() {
    cat > "$WEB_DIR/assets/js/dashboard.js" << 'EOF'
// Dashboard JavaScript
class HealthDashboard {
    constructor() {
        this.updateInterval = parseInt(document.body.dataset.updateInterval) || 30000;
        this.charts = {};
        this.performanceData = [];
        this.maxDataPoints = 20;
        
        this.init();
    }

    init() {
        this.initializeCharts();
        this.loadInitialData();
        this.startUpdateLoop();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Auto-refresh controls
        window.addEventListener('focus', () => this.refreshAll());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.refreshAll();
            }
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.updateSystemHealth(),
                this.updateStats(),
                this.updateDeploymentStatus(),
                this.updateResourceUsage(),
                this.updateAlerts(),
                this.updatePodStatus()
            ]);
            
            this.updateLastRefreshTime();
            this.updateOverallStatus();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async refreshAll() {
        const refreshButton = document.querySelector('.refresh-btn');
        if (refreshButton) {
            refreshButton.style.transform = 'rotate(360deg)';
            refreshButton.style.transition = 'transform 0.5s';
        }
        
        await this.loadInitialData();
        
        if (refreshButton) {
            setTimeout(() => {
                refreshButton.style.transform = 'rotate(0deg)';
            }, 500);
        }
    }

    startUpdateLoop() {
        setInterval(() => {
            this.loadInitialData();
        }, this.updateInterval);
    }

    async updateSystemHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            this.updateHealthItem('apiHealth', data.api || {});
            this.updateHealthItem('dbHealth', data.database || {});
            this.updateHealthItem('redisHealth', data.redis || {});
            this.updateHealthItem('k8sHealth', data.kubernetes || {});
        } catch (error) {
            console.error('Health check failed:', error);
            // Show offline status for all health items
            ['apiHealth', 'dbHealth', 'redisHealth', 'k8sHealth'].forEach(id => {
                this.updateHealthItem(id, { status: 'error', responseTime: 'N/A' });
            });
        }
    }

    updateHealthItem(elementId, healthData) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const statusElement = element.querySelector('.health-status');
        const valueElement = element.querySelector('.health-value');
        
        const status = healthData.status || 'error';
        const responseTime = healthData.responseTime || 'N/A';
        
        statusElement.className = `health-status ${status}`;
        valueElement.textContent = typeof responseTime === 'number' ? `${responseTime}ms` : responseTime;
    }

    async updateStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            this.updateStatValue('totalUsers', data.users?.total || 0, data.users?.change || 0);
            this.updateStatValue('activeUsers', data.users?.activeDaily || 0, data.users?.dauChange || 0);
            this.updateStatValue('recommendations', data.recommendations?.total || 0, data.recommendations?.change || 0);
            this.updateStatValue('responseTime', data.performance?.responseTime || 0, data.performance?.change || 0);
            
            // Update performance chart
            this.updatePerformanceChart(data.performance);
        } catch (error) {
            console.error('Stats update failed:', error);
        }
    }

    updateStatValue(elementId, value, change) {
        const valueElement = document.getElementById(elementId);
        const changeElement = document.getElementById(elementId.replace(/[A-Z]/g, c => c.toLowerCase()) + 'Change');
        
        if (valueElement) {
            if (elementId === 'responseTime') {
                valueElement.textContent = `${value}ms`;
            } else {
                valueElement.textContent = this.formatNumber(value);
            }
        }
        
        if (changeElement && change !== undefined) {
            const changeText = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
            changeElement.textContent = changeText;
            changeElement.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }

    async updateDeploymentStatus() {
        try {
            const response = await fetch('/api/deployment');
            const data = await response.json();
            
            document.getElementById('currentVersion').textContent = data.version || 'Unknown';
            document.getElementById('lastDeployment').textContent = this.formatTime(data.lastDeployment);
            
            const statusElement = document.getElementById('deploymentStatus');
            statusElement.textContent = data.status || 'Unknown';
            statusElement.className = `status ${this.getStatusClass(data.status)}`;
            
            document.getElementById('aiFlagStatus').textContent = `${data.featureFlags?.aiRecommendations || 0}%`;
            document.getElementById('templatesFlagStatus').textContent = `${data.featureFlags?.templates || 0}%`;
        } catch (error) {
            console.error('Deployment status update failed:', error);
        }
    }

    async updateResourceUsage() {
        try {
            const response = await fetch('/api/resources');
            const data = await response.json();
            
            this.updateResourceBar('cpu', data.cpu || 0);
            this.updateResourceBar('memory', data.memory || 0);
            this.updateResourceBar('disk', data.disk || 0);
        } catch (error) {
            console.error('Resource usage update failed:', error);
        }
    }

    updateResourceBar(resource, percentage) {
        const progressElement = document.getElementById(`${resource}Progress`);
        const valueElement = document.getElementById(`${resource}Value`);
        
        if (progressElement) {
            progressElement.style.width = `${percentage}%`;
            
            // Update color based on usage
            if (percentage > 90) {
                progressElement.className = 'progress-fill danger';
            } else if (percentage > 75) {
                progressElement.className = 'progress-fill warning';
            } else {
                progressElement.className = 'progress-fill';
            }
        }
        
        if (valueElement) {
            valueElement.textContent = `${percentage.toFixed(1)}%`;
        }
    }

    async updateAlerts() {
        try {
            const response = await fetch('/api/alerts');
            const data = await response.json();
            
            const alertsList = document.getElementById('alertsList');
            
            if (!data.alerts || data.alerts.length === 0) {
                alertsList.innerHTML = '<div class="no-alerts">No recent alerts</div>';
                return;
            }
            
            const alertsHtml = data.alerts.map(alert => `
                <div class="alert-item ${alert.severity || 'info'}">
                    <div class="alert-icon">${this.getAlertIcon(alert.severity)}</div>
                    <div class="alert-content">
                        <div class="alert-title">${alert.title || 'Alert'}</div>
                        <div class="alert-message">${alert.message || ''}</div>
                    </div>
                    <div class="alert-time">${this.formatTime(alert.timestamp)}</div>
                </div>
            `).join('');
            
            alertsList.innerHTML = alertsHtml;
        } catch (error) {
            console.error('Alerts update failed:', error);
        }
    }

    async updatePodStatus() {
        try {
            const response = await fetch('/api/pods');
            const data = await response.json();
            
            const podGrid = document.getElementById('podGrid');
            
            if (!data.pods || data.pods.length === 0) {
                podGrid.innerHTML = '<div class="loading">No pods found</div>';
                return;
            }
            
            const podsHtml = data.pods.map(pod => `
                <div class="pod-item">
                    <div class="pod-name">${pod.name}</div>
                    <div class="pod-status ${pod.status.toLowerCase()}">${pod.status}</div>
                </div>
            `).join('');
            
            podGrid.innerHTML = podsHtml;
        } catch (error) {
            console.error('Pod status update failed:', error);
            document.getElementById('podGrid').innerHTML = '<div class="loading">Failed to load pod status</div>';
        }
    }

    initializeCharts() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        this.charts.performance = new SimpleChart(ctx, canvas.width, canvas.height);
    }

    updatePerformanceChart(performanceData) {
        if (!performanceData || !this.charts.performance) return;
        
        this.performanceData.push({
            timestamp: Date.now(),
            responseTime: performanceData.responseTime || 0,
            cpu: performanceData.cpu || 0,
            memory: performanceData.memory || 0
        });
        
        // Keep only recent data points
        if (this.performanceData.length > this.maxDataPoints) {
            this.performanceData.shift();
        }
        
        this.charts.performance.update(this.performanceData);
    }

    updateOverallStatus() {
        const statusElement = document.getElementById('overallStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        // Simple heuristic for overall status
        const healthItems = document.querySelectorAll('.health-status');
        let healthyCount = 0;
        let totalCount = 0;
        
        healthItems.forEach(item => {
            totalCount++;
            if (item.classList.contains('healthy')) {
                healthyCount++;
            }
        });
        
        if (healthyCount === totalCount) {
            statusDot.className = 'status-dot';
            statusText.textContent = 'All Systems Operational';
        } else if (healthyCount >= totalCount * 0.5) {
            statusDot.className = 'status-dot warning';
            statusText.textContent = 'Partial Service Disruption';
        } else {
            statusDot.className = 'status-dot danger';
            statusText.textContent = 'Service Disruption';
        }
    }

    updateLastRefreshTime() {
        const element = document.getElementById('lastUpdated');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    }

    // Utility methods
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatTime(timestamp) {
        if (!timestamp) return 'N/A';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    }

    getStatusClass(status) {
        const statusMap = {
            'healthy': 'healthy',
            'completed': 'healthy',
            'running': 'healthy',
            'warning': 'warning',
            'pending': 'warning',
            'error': 'error',
            'failed': 'error',
            'critical': 'error'
        };
        
        return statusMap[status?.toLowerCase()] || 'warning';
    }

    getAlertIcon(severity) {
        const iconMap = {
            'error': '🚨',
            'warning': '⚠️',
            'info': 'ℹ️',
            'success': '✅'
        };
        
        return iconMap[severity] || 'ℹ️';
    }

    showError(message) {
        console.error(message);
        // Could implement toast notifications here
    }
}

// Simple Chart Implementation
class SimpleChart {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.padding = 40;
    }

    update(data) {
        this.clear();
        
        if (!data || data.length < 2) return;
        
        const chartWidth = this.width - (this.padding * 2);
        const chartHeight = this.height - (this.padding * 2);
        
        // Draw response time line
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        const maxResponseTime = Math.max(...data.map(d => d.responseTime));
        const minResponseTime = Math.min(...data.map(d => d.responseTime));
        const responseTimeRange = maxResponseTime - minResponseTime || 1;
        
        data.forEach((point, index) => {
            const x = this.padding + (index / (data.length - 1)) * chartWidth;
            const y = this.padding + chartHeight - ((point.responseTime - minResponseTime) / responseTimeRange) * chartHeight;
            
            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        
        this.ctx.stroke();
        
        // Draw axes
        this.drawAxes();
        
        // Draw labels
        this.drawLabels(data);
    }

    clear() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawAxes() {
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 1;
        
        // Y-axis
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding, this.padding);
        this.ctx.lineTo(this.padding, this.height - this.padding);
        this.ctx.stroke();
        
        // X-axis
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding, this.height - this.padding);
        this.ctx.lineTo(this.width - this.padding, this.height - this.padding);
        this.ctx.stroke();
    }

    drawLabels(data) {
        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        
        // X-axis labels (time)
        const labelCount = Math.min(5, data.length);
        for (let i = 0; i < labelCount; i++) {
            const index = Math.floor(i * (data.length - 1) / (labelCount - 1));
            const x = this.padding + (index / (data.length - 1)) * (this.width - this.padding * 2);
            const time = new Date(data[index].timestamp).toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            this.ctx.fillText(time, x, this.height - this.padding + 20);
        }
        
        // Y-axis label
        this.ctx.save();
        this.ctx.translate(20, this.height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Response Time (ms)', 0, 0);
        this.ctx.restore();
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new HealthDashboard();
});

// Global refresh function
window.refreshSystemHealth = () => {
    if (window.dashboard) {
        window.dashboard.updateSystemHealth();
    }
};
EOF
}

# Create API endpoints
create_api_endpoints() {
    # Health endpoint
    cat > "$WEB_DIR/api/health" << 'EOF'
#!/bin/bash
echo "Content-Type: application/json"
echo ""

# Get system health data
api_status="healthy"
api_response_time=0

# Test API health
if curl -s -f -m 5 "${APP_URL:-http://localhost:3000}/api/health" &>/dev/null; then
    api_status="healthy"
    api_response_time=$(curl -s -w "%{time_total}" -o /dev/null "${APP_URL:-http://localhost:3000}/api/health" | awk '{print int($1*1000)}')
else
    api_status="error"
    api_response_time="N/A"
fi

# Test database
db_status="healthy"
if ! timeout 5 psql "${DATABASE_URL:-}" -c "SELECT 1;" &>/dev/null; then
    db_status="error"
fi

# Test Redis
redis_status="healthy"
if ! timeout 5 redis-cli -u "${REDIS_URL:-}" ping &>/dev/null; then
    redis_status="error"
fi

# Test Kubernetes
k8s_status="healthy"
if ! timeout 5 kubectl cluster-info &>/dev/null; then
    k8s_status="error"
fi

cat << JSON
{
    "api": {
        "status": "$api_status",
        "responseTime": $api_response_time
    },
    "database": {
        "status": "$db_status",
        "responseTime": "N/A"
    },
    "redis": {
        "status": "$redis_status",
        "responseTime": "N/A"
    },
    "kubernetes": {
        "status": "$k8s_status",
        "responseTime": "N/A"
    }
}
JSON
EOF

    # Stats endpoint
    cat > "$WEB_DIR/api/stats" << 'EOF'
#!/bin/bash
echo "Content-Type: application/json"
echo ""

# Get current stats
if [[ -f "$PROJECT_DIR/metrics/adoption/current-state.json" ]]; then
    cat "$PROJECT_DIR/metrics/adoption/current-state.json" | jq '{
        users: .metrics.users,
        recommendations: .metrics.recommendations,
        performance: {
            responseTime: 150,
            cpu: 45,
            memory: 62,
            change: -2.5
        }
    }'
else
    echo '{
        "users": {
            "total": 0,
            "activeDaily": 0,
            "change": 0,
            "dauChange": 0
        },
        "recommendations": {
            "total": 0,
            "change": 0
        },
        "performance": {
            "responseTime": 0,
            "cpu": 0,
            "memory": 0,
            "change": 0
        }
    }'
fi
EOF

    # Deployment endpoint
    cat > "$WEB_DIR/api/deployment" << 'EOF'
#!/bin/bash
echo "Content-Type: application/json"
echo ""

# Get deployment info
version=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
last_deployment=$(git log -1 --format="%ci" 2>/dev/null || echo "unknown")
deployment_status="healthy"

# Check if deployment is in progress
if [[ -f "/tmp/deployment-in-progress" ]]; then
    deployment_status="deploying"
fi

# Get feature flag status
ai_rollout=100
template_rollout=100

if command -v redis-cli &>/dev/null && [[ -n "${REDIS_URL:-}" ]]; then
    ai_rollout=$(redis-cli -u "$REDIS_URL" GET "feature:ai_recommendations:percentage" 2>/dev/null || echo "100")
    template_rollout=$(redis-cli -u "$REDIS_URL" GET "feature:template_system:percentage" 2>/dev/null || echo "100")
fi

cat << JSON
{
    "version": "$version",
    "lastDeployment": "$last_deployment",
    "status": "$deployment_status",
    "featureFlags": {
        "aiRecommendations": $ai_rollout,
        "templates": $template_rollout
    }
}
JSON
EOF

    # Resources endpoint
    cat > "$WEB_DIR/api/resources" << 'EOF'
#!/bin/bash
echo "Content-Type: application/json"
echo ""

# Get resource usage
cpu_usage=0
memory_usage=0
disk_usage=0

# Try to get real metrics from Kubernetes
if command -v kubectl &>/dev/null; then
    # Get CPU usage (simplified)
    cpu_usage=$(kubectl top pods -n "${NAMESPACE:-buildmystack-prod}" --no-headers 2>/dev/null | \
                awk '{gsub(/m/,"",$2); sum+=$2} END {print int(sum/10)}' || echo "45")
    
    # Get memory usage (simplified)  
    memory_usage=$(kubectl top pods -n "${NAMESPACE:-buildmystack-prod}" --no-headers 2>/dev/null | \
                   awk '{gsub(/Mi/,"",$3); sum+=$3} END {print int(sum/10)}' || echo "62")
fi

# Get disk usage
disk_usage=$(df / | tail -1 | awk '{print int($5)}' || echo "35")

cat << JSON
{
    "cpu": $cpu_usage,
    "memory": $memory_usage,
    "disk": $disk_usage
}
JSON
EOF

    # Alerts endpoint
    cat > "$WEB_DIR/api/alerts" << 'EOF'
#!/bin/bash
echo "Content-Type: application/json"
echo ""

# Get recent alerts
alerts_file="$PROJECT_DIR/metrics/adoption/current-state.json"

if [[ -f "$alerts_file" ]]; then
    alerts=$(jq -r '.alerts[]' "$alerts_file" 2>/dev/null || echo "")
    
    if [[ -n "$alerts" ]]; then
        echo '{"alerts": ['
        echo "$alerts" | jq -R '{
            title: "Adoption Alert",
            message: .,
            severity: "warning",
            timestamp: now
        }' | paste -sd ',' -
        echo ']}'
    else
        echo '{"alerts": []}'
    fi
else
    echo '{"alerts": []}'
fi
EOF

    # Pods endpoint
    cat > "$WEB_DIR/api/pods" << 'EOF'
#!/bin/bash
echo "Content-Type: application/json"
echo ""

# Get pod status
if command -v kubectl &>/dev/null; then
    kubectl get pods -n "${NAMESPACE:-buildmystack-prod}" -o json 2>/dev/null | \
    jq '{
        pods: [
            .items[] | {
                name: .metadata.name,
                status: .status.phase
            }
        ]
    }'
else
    echo '{"pods": []}'
fi
EOF

    # Make all API endpoints executable
    chmod +x "$WEB_DIR"/api/*
}

# Start simple HTTP server for dashboard
start_dashboard_server() {
    echo -e "${GREEN}Starting dashboard server on port $DASHBOARD_PORT...${NC}"
    echo -e "${CYAN}Dashboard URL: http://localhost:$DASHBOARD_PORT${NC}"
    echo
    
    cd "$WEB_DIR"
    
    # Try different HTTP servers
    if command -v python3 &>/dev/null; then
        python3 -m http.server "$DASHBOARD_PORT"
    elif command -v python &>/dev/null; then
        python -m SimpleHTTPServer "$DASHBOARD_PORT"
    elif command -v node &>/dev/null; then
        npx http-server -p "$DASHBOARD_PORT"
    else
        echo -e "${RED}No HTTP server available. Please install Python or Node.js${NC}"
        return 1
    fi
}

# Generate static dashboard
generate_static_dashboard() {
    echo "Generating static dashboard..."
    
    # Collect current data
    local stats_data="{}"
    local health_data="{}"
    local deployment_data="{}"
    
    if [[ -f "$PROJECT_DIR/metrics/adoption/current-state.json" ]]; then
        stats_data=$(cat "$PROJECT_DIR/metrics/adoption/current-state.json")
    fi
    
    # Create static HTML with embedded data
    local static_file="$REPORTS_DIR/dashboard-$(date +%Y%m%d-%H%M%S).html"
    
    cp "$WEB_DIR/index.html" "$static_file"
    cp -r "$WEB_DIR/assets" "$(dirname "$static_file")/"
    
    # Embed data into HTML
    sed -i '' 's|fetch("/api/|fetch("data/|g' "$(dirname "$static_file")/assets/js/dashboard.js" 2>/dev/null || \
    sed -i 's|fetch("/api/|fetch("data/|g' "$(dirname "$static_file")/assets/js/dashboard.js"
    
    echo "Static dashboard generated: $static_file"
}

# Help function
show_help() {
    cat << EOF
BuildMyStack Health Dashboard

Usage: $0 <command> [options]

Commands:
  start                 Start interactive dashboard server
  generate              Generate static dashboard HTML
  init                  Initialize dashboard files only

Options:
  --port PORT           Dashboard port (default: 8080)
  --environment ENV     Environment (default: production)
  --namespace NS        Kubernetes namespace (default: buildmystack-prod)
  --update-interval SEC Update interval in seconds (default: 30)
  --help               Show this help message

Examples:
  # Start interactive dashboard
  $0 start

  # Start on custom port
  $0 start --port 9090

  # Generate static dashboard
  $0 generate
EOF
}

# Parse command line arguments
COMMAND="${1:-start}"
shift || true

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            DASHBOARD_PORT="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --update-interval)
            UPDATE_INTERVAL="$2"
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    case "$COMMAND" in
        "start")
            init_dashboard
            start_dashboard_server
            ;;
        "generate")
            init_dashboard
            generate_static_dashboard
            ;;
        "init")
            init_dashboard
            echo -e "${GREEN}Dashboard files initialized in $WEB_DIR${NC}"
            ;;
        *)
            echo "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
exit $?