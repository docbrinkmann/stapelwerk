# SSL Certificate Setup with Let's Encrypt

This guide covers setting up free SSL certificates for BuildMyStack using Let's Encrypt and Certbot.

## Prerequisites

- Domain name pointing to your server (buildmystack.minilab.live)
- Nginx installed and running
- Ports 80 and 443 open in firewall

## Install Certbot

### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

### CentOS/RHEL

```bash
sudo yum install certbot python3-certbot-nginx
```

## Method 1: Automated Installation (Recommended)

This method automatically configures Nginx for you.

```bash
# Obtain and install certificate
sudo certbot --nginx -d buildmystack.minilab.live

# Follow the prompts:
# - Enter email address for renewal notifications
# - Agree to Terms of Service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

## Method 2: Manual Installation

### Step 1: Copy Nginx Configuration

```bash
# Copy the nginx config
sudo cp config/nginx/buildmystack.conf /etc/nginx/sites-available/buildmystack

# Initially comment out SSL lines (lines 27-58) for first-time setup
sudo nano /etc/nginx/sites-available/buildmystack
```

### Step 2: Enable HTTP-only Configuration

Remove or comment out the HTTPS server block temporarily:

```nginx
# Comment out lines 27-149 (HTTPS server block)
# Keep only the HTTP server block (lines 10-24)
```

### Step 3: Enable Site and Test

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/buildmystack /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 4: Obtain Certificate

```bash
# Get certificate only (don't modify nginx yet)
sudo certbot certonly --nginx -d buildmystack.minilab.live

# Or use webroot method
sudo certbot certonly --webroot -w /var/www/certbot -d buildmystack.minilab.live
```

### Step 5: Update Nginx Configuration

```bash
# Uncomment the HTTPS server block
sudo nano /etc/nginx/sites-available/buildmystack

# Uncomment lines 27-149
```

### Step 6: Test and Reload

```bash
# Test configuration
sudo nginx -t

# If successful, reload
sudo systemctl reload nginx
```

## Verify SSL Installation

### Check Certificate

```bash
# View certificate details
sudo certbot certificates

# Should show:
# - Certificate Name: buildmystack.minilab.live
# - Expiry Date: ~90 days from now
# - Certificate Path: /etc/letsencrypt/live/buildmystack.minilab.live/fullchain.pem
```

### Test HTTPS

```bash
# Test from command line
curl -I https://buildmystack.minilab.live

# Should return:
# HTTP/2 200
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Test in Browser

Visit: `https://buildmystack.minilab.live`

- Should show secure connection (lock icon)
- No certificate warnings
- HTTP automatically redirects to HTTPS

### Test SSL Configuration

```bash
# Use SSL Labs (takes a few minutes)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=buildmystack.minilab.live

# Expected grade: A or A+
```

## Automatic Renewal

Let's Encrypt certificates expire after 90 days. Certbot automatically configures renewal.

### Check Renewal Timer

```bash
# Check if renewal timer is active
sudo systemctl status certbot.timer

# Should show: Active: active (waiting)
```

### Test Renewal

```bash
# Dry run (doesn't actually renew)
sudo certbot renew --dry-run

# Should complete without errors
```

### Manual Renewal

```bash
# Renew all certificates
sudo certbot renew

# Renew specific certificate
sudo certbot renew --cert-name buildmystack.minilab.live
```

### Renewal Hook (Optional)

Create a renewal hook to reload nginx after renewal:

```bash
# Create hook script
sudo nano /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
```

Add:

```bash
#!/bin/bash
systemctl reload nginx
```

Make executable:

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
```

## Firewall Configuration

Ensure ports are open:

```bash
# Allow HTTPS
sudo ufw allow 443/tcp

# Allow HTTP (for Let's Encrypt challenges)
sudo ufw allow 80/tcp

# Check status
sudo ufw status
```

## Troubleshooting

### Certificate Not Found

```bash
# Check if certificate exists
sudo ls -la /etc/letsencrypt/live/buildmystack.minilab.live/

# Should see: fullchain.pem, privkey.pem, chain.pem
```

### Nginx Fails to Start

```bash
# Check nginx error log
sudo tail -50 /var/log/nginx/error.log

# Check nginx configuration
sudo nginx -t

# Common issues:
# - SSL certificate paths incorrect
# - Permissions on certificate files
# - Syntax errors in config
```

### Domain Not Accessible

```bash
# Check DNS resolution
dig buildmystack.minilab.live

# Check if nginx is listening
sudo netstat -tlnp | grep nginx

# Should show:
# tcp 0 0 0.0.0.0:80 ... nginx
# tcp 0 0 0.0.0.0:443 ... nginx
```

### Rate Limit Exceeded

Let's Encrypt has rate limits (5 certificates per week for same domain).

Wait 1 week or use staging environment for testing:

```bash
# Use staging server (for testing only)
sudo certbot --staging --nginx -d buildmystack.minilab.live
```

### Permission Denied Errors

```bash
# Fix certificate permissions
sudo chmod 0644 /etc/letsencrypt/live/buildmystack.minilab.live/fullchain.pem
sudo chmod 0600 /etc/letsencrypt/live/buildmystack.minilab.live/privkey.pem
```

## Monitoring

### Certificate Expiry Alerts

Certbot sends email notifications to the address you provided during setup.

### Manual Expiry Check

```bash
# Check expiry date
sudo certbot certificates | grep Expiry

# Or
echo | openssl s_client -servername buildmystack.minilab.live -connect buildmystack.minilab.live:443 2>/dev/null | openssl x509 -noout -dates
```

### Renewal Log

```bash
# Check renewal logs
sudo tail -50 /var/log/letsencrypt/letsencrypt.log
```

## Backup Certificates

```bash
# Backup Let's Encrypt directory
sudo tar -czf letsencrypt-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# Store backup securely
sudo mv letsencrypt-backup-*.tar.gz /opt/build-my-stack/backups/
```

## Alternative: Manual Certificate

If you have your own SSL certificate:

```bash
# Copy certificates
sudo cp your-cert.crt /etc/ssl/certs/buildmystack.crt
sudo cp your-key.key /etc/ssl/private/buildmystack.key

# Update nginx config
sudo nano /etc/nginx/sites-available/buildmystack

# Change SSL certificate paths:
ssl_certificate /etc/ssl/certs/buildmystack.crt;
ssl_certificate_key /etc/ssl/private/buildmystack.key;
```

## Security Best Practices

1. ✅ Use TLS 1.2 and 1.3 only
2. ✅ Enable HSTS
3. ✅ Use strong cipher suites
4. ✅ Enable OCSP stapling
5. ✅ Set security headers
6. ✅ Auto-renewal configured
7. ✅ Monitor certificate expiry
8. ✅ Regular backups

## Verification Checklist

- [ ] Certbot installed
- [ ] SSL certificate obtained
- [ ] Nginx configured with HTTPS
- [ ] HTTP redirects to HTTPS
- [ ] Certificate is valid and trusted
- [ ] SSL Labs grade A or A+
- [ ] Auto-renewal configured
- [ ] Renewal timer active
- [ ] Firewall allows ports 80 and 443
- [ ] Monitoring set up

## Support

For SSL issues:
- Check logs: `/var/log/letsencrypt/letsencrypt.log`
- Nginx errors: `/var/log/nginx/error.log`
- Test config: `sudo nginx -t`
- Certbot help: `sudo certbot --help`
- Let's Encrypt docs: https://letsencrypt.org/docs/
