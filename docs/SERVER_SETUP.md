# Server Setup Guide

This guide covers the setup of the production server for Stapelwerk deployment.

## Server Information

- **Host:** *************** (gitlab.minilab.live)
- **Purpose:** Docker container hosting for Next.js application
- **Database:** PostgreSQL 18
- **Container Registry:** GitLab Container Registry

## Prerequisites

### 1. Install Docker Engine

```bash
# Update package index
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group
sudo usermod -aG docker $USER

# Verify installation
docker --version
```

### 2. Install Docker Compose

```bash
# Install docker-compose plugin
sudo apt-get install docker-compose-plugin

# Verify installation
docker compose version
```

### 3. Create Application Directory

```bash
# Create directory structure
sudo mkdir -p /opt/stapelwerk/{data,logs,backups,scripts}
sudo chown -R $USER:$USER /opt/stapelwerk
cd /opt/stapelwerk
```

## SSH Key Setup for GitLab CI/CD

### 1. Generate SSH Key Pair

```bash
# On your local machine
ssh-keygen -t ed25519 -C "gitlab-ci-deploy@stapelwerk" -f ~/.ssh/gitlab-ci-stapelwerk

# This creates:
# - ~/.ssh/gitlab-ci-stapelwerk (private key)
# - ~/.ssh/gitlab-ci-stapelwerk.pub (public key)
```

### 2. Add Public Key to Server

```bash
# On the server (as deployment user)
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key
echo "ssh-ed25519 AAAAC3... gitlab-ci-deploy@stapelwerk" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. Test SSH Connection

```bash
# From your local machine
ssh -i ~/.ssh/gitlab-ci-stapelwerk user@***************

# Should connect without password
```

## GitLab Container Registry Authentication

### 1. Create Deploy Token

1. Go to GitLab project → **Settings** → **Repository** → **Deploy tokens**
2. Name: `server-deploy-token`
3. Scopes: ☑ `read_registry`
4. Click **Create deploy token**
5. **Save the username and token** (shown only once)

### 2. Login to Registry on Server

```bash
# On the server
docker login registry.gitlab.minilab.live -u <deploy-token-username> -p <deploy-token>

# Verify
docker info | grep Registry
```

## Environment Configuration

### 1. Copy Environment Template

```bash
cd /opt/stapelwerk
cp .env.production.example .env.production
```

### 2. Edit Environment Variables

```bash
nano .env.production
```

**Required variables to update:**
- `POSTGRES_PASSWORD` - Strong password (32+ characters)
- `DATABASE_URL` - Update with the password
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `CI_REGISTRY_IMAGE` - Your GitLab registry path

### 3. Secure the Environment File

```bash
chmod 600 .env.production
```

## Copy Required Files to Server

```bash
# From your local machine
scp docker-compose.prod.yml user@***************:/opt/stapelwerk/docker-compose.yml
scp .env.production user@***************:/opt/stapelwerk/.env.production
```

## GitLab CI/CD Variables Setup

Add these variables in GitLab project → **Settings** → **CI/CD** → **Variables**:

| Variable | Type | Value | Protected | Masked |
|----------|------|-------|-----------|--------|
| `SSH_PRIVATE_KEY` | File | Content of ~/.ssh/gitlab-ci-stapelwerk | ✓ | ✓ |
| `SERVER_HOST` | Variable | *************** | ✓ | ✗ |
| `SERVER_USER` | Variable | your-username | ✓ | ✗ |
| `DATABASE_URL` | Variable | postgresql://... | ✓ | ✓ |
| `NEXTAUTH_SECRET` | Variable | generated-secret | ✓ | ✓ |
| `NEXTAUTH_URL` | Variable | https://stapelwerk.minilab.live | ✓ | ✗ |

## Initial Deployment Test

### 1. Pull a Test Image

```bash
cd /opt/stapelwerk

# Pull PostgreSQL image
docker pull postgres:18-alpine

# Start only database
docker compose up -d postgres

# Check status
docker compose ps
docker compose logs postgres
```

### 2. Test Database Connection

```bash
# Connect to database
docker compose exec postgres psql -U stapelwerk_user -d stapelwerk

# Run test query
SELECT version();

# Exit
\q
```

## Firewall Configuration

```bash
# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS for reverse proxy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Docker port 3000 should NOT be exposed externally
# (will be accessed via reverse proxy only)

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

## Security Hardening

### 1. SSH Configuration

Edit `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Update these settings:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

### 2. Install Fail2Ban

```bash
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Enable Automatic Security Updates

```bash
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Monitoring Setup

### 1. Install Basic Monitoring Tools

```bash
sudo apt-get install htop iotop nethogs
```

### 2. Check System Resources

```bash
# CPU and Memory
htop

# Disk usage
df -h

# Docker stats
docker stats

# Container logs
docker compose logs -f
```

## Verification Checklist

- [ ] Docker and docker-compose installed
- [ ] Application directory created
- [ ] SSH key authentication working
- [ ] GitLab Container Registry login successful
- [ ] Environment variables configured
- [ ] Firewall configured
- [ ] SSH hardened
- [ ] PostgreSQL 18 container running
- [ ] Database connection tested
- [ ] Security updates enabled

## Next Steps

After server setup is complete:

1. Create deployment scripts (deploy.sh, rollback.sh)
2. Configure GitLab CI/CD pipeline
3. Set up automated backups
4. Configure reverse proxy (nginx)
5. Install SSL certificates

## Troubleshooting

### Docker Permission Denied

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again
exit
```

### Cannot Connect to Database

```bash
# Check container status
docker compose ps

# Check logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### SSH Connection Issues

```bash
# Test connection with verbose output
ssh -vvv -i ~/.ssh/gitlab-ci-stapelwerk user@***************

# Check authorized_keys permissions
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

## Support

For issues during setup, check:
- GitLab CI/CD logs
- Docker container logs: `docker compose logs`
- System logs: `sudo journalctl -xe`
- Server setup documentation in `.agent-os/specs/2025-10-14-gitlab-pages-deployment/sub-specs/server-setup.md`
