#!/bin/bash

# Trivy CLI Installation and Configuration Script
# This script installs Trivy CLI and configures automatic database updates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TRIVY_VERSION="0.50.1"
TRIVY_CACHE_DIR="/var/cache/trivy"
TRIVY_CONFIG_DIR="/etc/trivy"
TRIVY_LOG_DIR="/var/log/trivy"

echo -e "${GREEN}🔒 Trivy Security Scanner Installation and Configuration${NC}"
echo "=================================================="

# Check if running as root for system-wide installation
if [[ $EUID -eq 0 ]]; then
  echo -e "${YELLOW}Running as root - installing system-wide${NC}"
  INSTALL_DIR="/usr/local/bin"
  USER_CACHE_DIR="$TRIVY_CACHE_DIR"
else
  echo -e "${YELLOW}Running as user - installing to home directory${NC}"
  INSTALL_DIR="$HOME/.local/bin"
  USER_CACHE_DIR="$HOME/.cache/trivy"
  TRIVY_CONFIG_DIR="$HOME/.config/trivy"
  TRIVY_LOG_DIR="$HOME/.local/share/trivy/logs"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$USER_CACHE_DIR"
mkdir -p "$TRIVY_CONFIG_DIR"
mkdir -p "$TRIVY_LOG_DIR"

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin)
    OS_NAME="macOS"
    ;;
  Linux)
    OS_NAME="Linux"
    ;;
  *)
    echo -e "${RED}❌ Unsupported OS: $OS${NC}"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64)
    ARCH_NAME="64bit"
    ;;
  arm64)
    ARCH_NAME="ARM64"
    ;;
  armv7l)
    ARCH_NAME="ARM"
    ;;
  *)
    echo -e "${RED}❌ Unsupported architecture: $ARCH${NC}"
    exit 1
    ;;
esac

echo "🖥️  Detected OS: $OS ($OS_NAME), Architecture: $ARCH ($ARCH_NAME)"

# Download Trivy
TRIVY_TAR="trivy_${TRIVY_VERSION}_${OS_NAME}-${ARCH_NAME}.tar.gz"
DOWNLOAD_URL="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/${TRIVY_TAR}"

echo "⬇️  Downloading Trivy v${TRIVY_VERSION}..."
cd /tmp

if command -v curl &> /dev/null; then
  curl -L -o "$TRIVY_TAR" "$DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
  wget -O "$TRIVY_TAR" "$DOWNLOAD_URL"
else
  echo -e "${RED}❌ Neither curl nor wget found. Please install one of them.${NC}"
  exit 1
fi

# Verify download
if [[ ! -f "$TRIVY_TAR" ]]; then
  echo -e "${RED}❌ Failed to download Trivy${NC}"
  exit 1
fi

# Extract and install
echo "📦 Extracting Trivy..."
tar -xzf "$TRIVY_TAR"
chmod +x trivy
mv trivy "$INSTALL_DIR/"

# Clean up
rm -f "$TRIVY_TAR"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo "🔧 Adding $INSTALL_DIR to PATH..."
  echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> ~/.bashrc
  echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> ~/.zshrc 2>/dev/null || true
  export PATH="$INSTALL_DIR:$PATH"
fi

# Verify installation
echo "✅ Verifying installation..."
if "$INSTALL_DIR/trivy" --version; then
  echo -e "${GREEN}✅ Trivy installed successfully${NC}"
else
  echo -e "${RED}❌ Trivy installation verification failed${NC}"
  exit 1
fi

# Create configuration file
echo "📝 Creating Trivy configuration..."
cat > "$TRIVY_CONFIG_DIR/trivy.yaml" << EOF
# Trivy Configuration for Build My Stack
# Auto-generated configuration file

# Cache settings
cache:
  dir: "$USER_CACHE_DIR"
  
# Database settings
db:
  # Update database every 6 hours (21600 seconds)
  update-interval: 21600
  no-progress: false
  skip-update: false
  
# Output settings
format: json
severity: UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL
exit-code: 0

# Performance settings
timeout: 5m0s
parallel: 5

# Scanning settings
skip-files:
  - "*.log"
  - "*.tmp"
  - "node_modules/**"
  - ".git/**"
  
security-checks: vuln,config,secret
scanners: vuln,config,secret,license

# Offline mode settings (disabled by default)
offline-scan: false

# Logging
log:
  level: info
  file: "$TRIVY_LOG_DIR/trivy.log"
EOF

echo -e "${GREEN}✅ Configuration file created: $TRIVY_CONFIG_DIR/trivy.yaml${NC}"

# Create database update script
echo "⚙️  Creating automatic database update script..."
cat > "$TRIVY_CONFIG_DIR/update-db.sh" << 'EOF'
#!/bin/bash

# Trivy Database Update Script
# This script updates the Trivy vulnerability database

set -e

TRIVY_BIN="trivy"
LOG_FILE="$(dirname "$0")/../logs/trivy-update.log"
LOCK_FILE="/tmp/trivy-update.lock"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Check if update is already running
if [[ -f "$LOCK_FILE" ]]; then
  echo "$(date): Database update already in progress" >> "$LOG_FILE"
  exit 0
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Cleanup function
cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

echo "$(date): Starting Trivy database update..." >> "$LOG_FILE"

# Update the database
if $TRIVY_BIN db update 2>> "$LOG_FILE"; then
  echo "$(date): Database update completed successfully" >> "$LOG_FILE"
  
  # Log database info
  $TRIVY_BIN db info 2>> "$LOG_FILE" || true
  
  exit 0
else
  echo "$(date): Database update failed" >> "$LOG_FILE"
  exit 1
fi
EOF

chmod +x "$TRIVY_CONFIG_DIR/update-db.sh"

# Set up cron job for automatic updates (every 6 hours)
echo "⏰ Setting up automatic database updates..."

# Create cron job entry
CRON_JOB="0 */6 * * * $TRIVY_CONFIG_DIR/update-db.sh >/dev/null 2>&1"

# Add cron job if it doesn't already exist
(crontab -l 2>/dev/null | grep -v "update-db.sh" ; echo "$CRON_JOB") | crontab -

echo -e "${GREEN}✅ Automatic database updates configured (every 6 hours)${NC}"

# Initial database update
echo "🔄 Performing initial database update..."
if "$INSTALL_DIR/trivy" db update; then
  echo -e "${GREEN}✅ Initial database update completed${NC}"
else
  echo -e "${YELLOW}⚠️  Initial database update failed, but continuing...${NC}"
fi

# Create systemd service for automatic updates (if systemd is available)
if command -v systemctl &> /dev/null && [[ $EUID -eq 0 ]]; then
  echo "🔧 Creating systemd service for database updates..."
  
  cat > /etc/systemd/system/trivy-db-update.service << EOF
[Unit]
Description=Trivy Vulnerability Database Update
After=network.target

[Service]
Type=oneshot
ExecStart=$TRIVY_CONFIG_DIR/update-db.sh
User=trivy
Group=trivy
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/trivy-db-update.timer << EOF
[Unit]
Description=Run Trivy DB update every 6 hours
Requires=trivy-db-update.service

[Timer]
OnCalendar=*:0/6:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

  # Create trivy user if it doesn't exist
  if ! id "trivy" &>/dev/null; then
    useradd --system --shell /bin/false --home-dir "$TRIVY_CACHE_DIR" --create-home trivy
    chown -R trivy:trivy "$TRIVY_CACHE_DIR" "$TRIVY_LOG_DIR"
  fi

  systemctl daemon-reload
  systemctl enable trivy-db-update.timer
  systemctl start trivy-db-update.timer
  
  echo -e "${GREEN}✅ Systemd service created and enabled${NC}"
fi

# Create health check script
echo "🏥 Creating health check script..."
cat > "$TRIVY_CONFIG_DIR/health-check.sh" << 'EOF'
#!/bin/bash

# Trivy Health Check Script
# Verifies that Trivy is working correctly

TRIVY_BIN="trivy"
TEST_IMAGE="hello-world:latest"

echo "🔍 Trivy Health Check"
echo "===================="

# Check if trivy command is available
if ! command -v $TRIVY_BIN &> /dev/null; then
  echo "❌ Trivy command not found"
  exit 1
fi

# Check trivy version
echo "📝 Trivy version:"
$TRIVY_BIN --version

# Check database status
echo ""
echo "🗄️  Database status:"
$TRIVY_BIN db info

# Quick scan test
echo ""
echo "🧪 Performing test scan on $TEST_IMAGE..."
if $TRIVY_BIN image --quiet --format table $TEST_IMAGE; then
  echo "✅ Test scan completed successfully"
else
  echo "❌ Test scan failed"
  exit 1
fi

echo ""
echo "✅ Trivy health check passed!"
EOF

chmod +x "$TRIVY_CONFIG_DIR/health-check.sh"

# Create uninstall script
echo "🗑️  Creating uninstall script..."
cat > "$TRIVY_CONFIG_DIR/uninstall.sh" << EOF
#!/bin/bash

# Trivy Uninstall Script

echo "🗑️  Uninstalling Trivy..."

# Remove binary
rm -f "$INSTALL_DIR/trivy"

# Remove cron job
crontab -l 2>/dev/null | grep -v "update-db.sh" | crontab -

# Remove systemd service (if running as root)
if [[ \$EUID -eq 0 ]] && command -v systemctl &> /dev/null; then
  systemctl stop trivy-db-update.timer 2>/dev/null || true
  systemctl disable trivy-db-update.timer 2>/dev/null || true
  rm -f /etc/systemd/system/trivy-db-update.service
  rm -f /etc/systemd/system/trivy-db-update.timer
  systemctl daemon-reload
fi

# Optionally remove cache and config (prompt user)
read -p "Remove cache and configuration files? (y/N): " -n 1 -r
echo
if [[ \$REPLY =~ ^[Yy]$ ]]; then
  rm -rf "$USER_CACHE_DIR"
  rm -rf "$TRIVY_CONFIG_DIR"
  rm -rf "$TRIVY_LOG_DIR"
  echo "✅ Cache and configuration removed"
fi

echo "✅ Trivy uninstalled successfully"
EOF

chmod +x "$TRIVY_CONFIG_DIR/uninstall.sh"

# Summary
echo ""
echo -e "${GREEN}🎉 Trivy installation and configuration completed!${NC}"
echo "=================================================="
echo "📍 Installation directory: $INSTALL_DIR"
echo "📁 Cache directory: $USER_CACHE_DIR"
echo "⚙️  Configuration directory: $TRIVY_CONFIG_DIR"
echo "📊 Log directory: $TRIVY_LOG_DIR"
echo ""
echo "🔧 Available scripts:"
echo "  • Health check: $TRIVY_CONFIG_DIR/health-check.sh"
echo "  • Manual DB update: $TRIVY_CONFIG_DIR/update-db.sh"
echo "  • Uninstall: $TRIVY_CONFIG_DIR/uninstall.sh"
echo ""
echo "⏰ Database updates: Every 6 hours (automatic)"
echo "📝 Configuration file: $TRIVY_CONFIG_DIR/trivy.yaml"
echo ""
echo "🏃 To get started, run:"
echo "  trivy image --help"
echo "  $TRIVY_CONFIG_DIR/health-check.sh"
echo ""
echo -e "${YELLOW}💡 Tip: Restart your terminal or run 'source ~/.bashrc' to update PATH${NC}"