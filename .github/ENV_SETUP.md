# Environment Configuration and Secrets Management

This document outlines the required environment variables and secrets configuration for the CI/CD pipelines and deployments.

## Required GitHub Secrets

### Deployment Secrets

#### `VERCEL_TOKEN`
- **Description**: Vercel authentication token for deployment
- **How to obtain**: 
  1. Go to [Vercel Dashboard → Settings → Tokens](https://vercel.com/account/tokens)
  2. Create a new token with appropriate permissions
  3. Add to GitHub repo secrets

#### `VERCEL_ORG_ID` (Optional)
- **Description**: Vercel organization ID for team deployments
- **How to obtain**: Found in Vercel team settings
- **Required**: Only for team/organization deployments

#### `DATABASE_URL`
- **Description**: Production database connection string
- **Format**: `postgresql://user:password@host:port/database`
- **Security**: Ensure this is for production database only

### Security Scanning Secrets

#### `SNYK_TOKEN` (Optional)
- **Description**: Snyk authentication token for security scanning
- **How to obtain**: 
  1. Create account at [Snyk.io](https://snyk.io)
  2. Go to Account Settings → General → Auth Token
  3. Add to GitHub repo secrets
- **Required**: Only if using Snyk security scanning

#### `LHCI_GITHUB_APP_TOKEN` (Optional)
- **Description**: Lighthouse CI GitHub app token
- **How to obtain**: Follow [LHCI GitHub App setup](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)
- **Required**: Only for PR performance comments

#### `LHCI_TOKEN` (Optional)
- **Description**: Lighthouse CI server token
- **Required**: Only if using LHCI server for performance tracking

### Notification Secrets

#### `SLACK_WEBHOOK_URL` (Optional)
- **Description**: Slack webhook URL for deployment notifications
- **How to obtain**: 
  1. Create Slack app with Incoming Webhooks
  2. Add webhook URL to GitHub secrets
- **Required**: Only for Slack notifications

## Environment-Specific Configuration

### Development Environment
```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stapelwerk_dev
REDIS_URL=redis://localhost:6379
NEXT_TELEMETRY_DISABLED=1
```

### Test Environment
```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stapelwerk_test
REDIS_URL=redis://localhost:6379
```

### Staging Environment
```bash
NODE_ENV=staging
DATABASE_URL=<staging-database-url>
REDIS_URL=<staging-redis-url>
NEXTAUTH_URL=https://stapelwerk-staging.vercel.app
```

### Production Environment
```bash
NODE_ENV=production
DATABASE_URL=<production-database-url>
REDIS_URL=<production-redis-url>
NEXTAUTH_URL=https://stapelwerk.vercel.app
```

## Vercel Environment Configuration

### Environment Variables in Vercel

The following environment variables should be configured in Vercel:

1. **Production Environment**:
   ```
   NODE_ENV=production
   DATABASE_URL=@database_url
   NEXTAUTH_URL=@nextauth_url
   NEXTAUTH_SECRET=@nextauth_secret
   SENTRY_DSN=@sentry_dsn
   ```

2. **Preview Environment**:
   ```
   NODE_ENV=staging
   DATABASE_URL=@staging_database_url
   NEXTAUTH_URL=@staging_nextauth_url
   NEXTAUTH_SECRET=@staging_nextauth_secret
   ```

### Vercel Secret Management

Use Vercel's secret management for sensitive values:

```bash
# Production secrets
vercel secrets add database_url "postgresql://..."
vercel secrets add nextauth_secret "your-secret-key"
vercel secrets add sentry_dsn "https://..."

# Staging secrets
vercel secrets add staging_database_url "postgresql://..."
vercel secrets add staging_nextauth_url "https://stapelwerk-staging.vercel.app"
vercel secrets add staging_nextauth_secret "staging-secret-key"
```

## Database Configuration

### Production Database
- Use a managed PostgreSQL service (e.g., Supabase, PlanetScale, Neon)
- Enable connection pooling
- Set appropriate connection limits
- Enable SSL connections
- Configure read replicas if needed

### Staging Database
- Use a separate database instance from production
- Can be a smaller tier than production
- Should mirror production schema

### Test Database
- Separate database for CI/CD testing
- Automatically created and destroyed during tests
- Uses Docker PostgreSQL in GitHub Actions

## Redis Configuration

### Production Redis
- Use a managed Redis service (e.g., Upstash, Redis Cloud)
- Configure appropriate memory limits
- Enable persistence if needed
- Set up monitoring

### Staging Redis
- Separate instance from production
- Can be smaller than production

## Security Best Practices

### Secret Rotation
- Rotate database credentials regularly
- Update API tokens periodically
- Monitor secret usage and access

### Access Control
- Limit GitHub repo secret access to necessary team members
- Use principle of least privilege for service accounts
- Audit secret access regularly

### Environment Isolation
- Keep production, staging, and development environments completely separate
- Never use production credentials in non-production environments
- Use different service accounts for different environments

## Monitoring and Alerts

### Required Monitoring
- Database connection health
- Redis connection health
- API response times
- Error rates
- Deployment success/failure

### Recommended Alerts
- High error rates
- Database connection failures
- Deployment failures
- Performance degradation
- Security scan failures

## Backup and Disaster Recovery

### Database Backups
- Daily automated backups
- Cross-region backup storage
- Regular backup restoration tests

### Configuration Backups
- Document all environment configurations
- Version control infrastructure as code
- Maintain disaster recovery playbooks

## Initial Setup Checklist

- [ ] Set up Vercel account and team
- [ ] Configure production database
- [ ] Configure staging database
- [ ] Set up Redis instances
- [ ] Add required GitHub secrets
- [ ] Configure Vercel environment variables
- [ ] Test deployment pipeline
- [ ] Verify security scanning
- [ ] Set up monitoring and alerts
- [ ] Document custom configurations

## Troubleshooting

### Common Issues

#### Deployment Failures
- Check Vercel token permissions
- Verify environment variables are set
- Check build logs for dependency issues

#### Database Connection Issues
- Verify DATABASE_URL format
- Check network connectivity
- Ensure database server is running

#### Security Scan Failures
- Update vulnerable dependencies
- Check Snyk token validity
- Review security test configurations

### Getting Help

1. Check GitHub Actions logs
2. Review Vercel deployment logs
3. Consult this documentation
4. Contact team members for access issues