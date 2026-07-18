# End-to-End Test Suite

This directory contains comprehensive end-to-end (E2E) tests for the Build My Stack service discovery and contribution flows. The tests validate complete user workflows, performance requirements, and security measures.

## Overview

The E2E test suite is designed to verify that the application works correctly from a user's perspective, testing real workflows across the entire system stack including:

- Service discovery through browsing and searching
- External service imports from Docker Hub
- Manual service contributions
- Admin review and approval workflows
- Performance requirements (< 500ms response times)
- Security validation and injection prevention

## Test Structure

```
src/__tests__/e2e/
├── README.md                           # This documentation
├── service-discovery-flows.test.ts     # Main workflow tests
├── performance-security-flows.test.ts  # Performance & security tests  
├── e2e.config.ts                      # Test configuration and utilities
└── run-e2e-tests.ts                   # Test runner and orchestration
```

## Test Coverage

### Service Discovery Flows (`service-discovery-flows.test.ts`)

**Complete User Workflows:**
- Service discovery through category browsing
- Search and filtering functionality
- Pagination handling
- Service detail viewing
- External import submissions (Docker Hub)
- Manual service contributions
- User interaction validation

**Admin Workflows:**
- Dashboard overview and statistics
- Import review and approval process
- Bulk operations on multiple imports
- Service status management
- System monitoring capabilities

**Edge Cases:**
- Empty result handling
- Invalid input validation
- Concurrent user scenarios
- Data consistency checks

### Performance & Security Tests (`performance-security-flows.test.ts`)

**Performance Requirements:**
- < 500ms response time validation for all endpoints
- Concurrent request handling (up to 50 simultaneous requests)
- Pagination performance under stress (100+ services)
- Bulk operation performance (100+ items)
- Database performance monitoring

**Security Validation:**
- SQL injection prevention testing
- XSS attack prevention
- Input sanitization validation
- Path traversal attack prevention
- Command injection prevention
- Role-based access control verification
- Resource exhaustion attack handling
- Rate limiting validation

**Load Testing:**
- Concurrent user simulation
- High-volume data scenarios
- Memory usage validation
- Database connection limits

## Configuration

The test suite uses environment-specific configurations defined in `e2e.config.ts`:

### Environments

- **test**: Lenient performance thresholds for local development
- **ci**: Adjusted for CI/CD environment limitations  
- **production**: Strict performance requirements matching production specs

### Performance Thresholds

```typescript
performance: {
  maxResponseTime: 500,        // Must be under 500ms per tech spec
  maxConcurrentRequests: 50,   // Concurrent request limit
  maxBulkOperationSize: 100,   // Bulk operation size limit
  paginationStressSize: 100    // Pagination stress test size
}
```

### Security Patterns

The test suite validates against 10+ malicious patterns including:
- SQL injection attempts
- XSS attack vectors
- Path traversal attempts
- Command injection patterns

## Running Tests

### Prerequisites

1. **Database Setup**: Ensure test database is configured
   ```bash
   npx prisma db push --accept-data-loss
   ```

2. **Dependencies**: Install all project dependencies
   ```bash
   npm install
   ```

### Basic Usage

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suites
npm run test:e2e -- --suite=flows       # Workflow tests only
npm run test:e2e -- --perf              # Performance tests only  
npm run test:e2e -- --security          # Security tests only

# Run with additional options
npm run test:e2e -- --verbose           # Detailed output
npm run test:e2e -- --coverage          # Include coverage report
npm run test:e2e -- --bail              # Stop on first failure
```

### Advanced Options

```bash
# Environment-specific runs
npm run test:e2e -- --environment=ci

# Custom timeout (default: 5 minutes)
npm run test:e2e -- --timeout=600000

# Parallel execution (where supported)
npm run test:e2e -- --parallel
```

### Programmatic Usage

```typescript
import { E2ETestRunner } from './run-e2e-tests'

const runner = new E2ETestRunner()
await runner.run({
  suite: 'flows',
  environment: 'test',
  coverage: true,
  verbose: true
})
```

## Test Data Management

### Setup and Cleanup

Tests automatically handle:
- Database schema setup and migration
- Test data creation and seeding
- Clean teardown after each test
- Transaction isolation between tests

### Test Data Generation

The test suite includes utilities for generating realistic test data:

```typescript
import { TestDataGenerator } from './e2e.config'

// Generate test services
const services = TestDataGenerator.generateBulkTestData(100, 
  TestDataGenerator.generateService)

// Generate test categories  
const category = TestDataGenerator.generateCategory({
  name: 'Custom Category',
  slug: 'custom-category'
})
```

## Performance Monitoring

The test suite includes built-in performance monitoring that tracks:
- Individual request response times
- Concurrent request performance
- Database query performance
- Memory usage patterns
- System resource utilization

### Performance Assertions

```typescript
import { PerformanceAssertions } from './e2e.config'

const perf = new PerformanceAssertions()
perf.assertResponseTime(responseTime, 'services.list')
perf.assertConcurrentPerformance(totalTime, requestCount)
```

## Security Testing

### Malicious Pattern Testing

The security test suite validates protection against:

```typescript
// SQL injection patterns
\"'; DROP TABLE services; --\"
\"1' OR '1'='1\"

// XSS patterns  
'<script>alert(\"xss\")</script>'
'<img src=\"x\" onerror=\"alert(1)\">'

// Path traversal patterns
'../../../etc/passwd'
'file:///etc/passwd'
```

### Input Validation Testing

Tests verify proper handling of:
- Oversized input (beyond field limits)
- Invalid data formats
- Malformed URLs and Docker image names
- Special characters and encoding issues

## Error Handling

The test suite validates proper error handling for:
- Network failures during imports
- Database connection issues  
- Invalid user permissions
- Malformed requests
- Resource not found scenarios
- Rate limiting responses

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run E2E Tests
  run: |
    npm run test:e2e -- --environment=ci --coverage --bail
  env:
    NODE_ENV: test
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

### Docker Support

Tests can run in containerized environments:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run test:e2e -- --environment=ci
```

## Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Reset test database
npx prisma db reset --force
npx prisma db push
```

**Timeout Issues:**
```bash
# Increase timeout for slow environments
npm run test:e2e -- --timeout=900000  # 15 minutes
```

**Memory Issues:**
```bash
# Run with increased Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test:e2e
```

### Performance Debugging

If performance tests fail:

1. **Check System Resources**: Ensure adequate CPU/memory
2. **Database Performance**: Verify database is properly indexed
3. **Network Latency**: Check for network-related delays
4. **Concurrent Load**: Reduce concurrent request limits

### Security Test Failures

If security tests fail:

1. **Input Validation**: Check input sanitization implementation
2. **SQL Injection**: Verify parameterized queries are used
3. **Access Control**: Confirm role-based permissions
4. **Error Messages**: Ensure no sensitive data in error responses

## Best Practices

### Writing E2E Tests

1. **Test Real User Scenarios**: Focus on actual user workflows
2. **Use Realistic Data**: Generate test data that mirrors production
3. **Test Error Conditions**: Include negative test cases
4. **Performance Aware**: Always include timing assertions
5. **Cleanup Properly**: Ensure tests don't leave side effects

### Test Organization

1. **Logical Grouping**: Group related tests together
2. **Clear Descriptions**: Use descriptive test names
3. **Setup/Teardown**: Isolate tests properly
4. **Documentation**: Comment complex test scenarios

### Performance Testing

1. **Baseline Measurements**: Establish performance baselines
2. **Consistent Environment**: Use consistent test environments
3. **Multiple Runs**: Average results over multiple runs
4. **Resource Monitoring**: Monitor system resources during tests

## Contributing

When adding new E2E tests:

1. **Follow Patterns**: Use existing test patterns and utilities
2. **Update Configuration**: Add new scenarios to `e2e.config.ts`
3. **Document Changes**: Update this README for new test types
4. **Performance Impact**: Consider performance implications
5. **Security Coverage**: Include security validation where applicable

## Maintenance

### Regular Tasks

- **Update Test Data**: Keep test data current with schema changes
- **Performance Baselines**: Review and update performance thresholds
- **Security Patterns**: Add new attack patterns as they emerge
- **Environment Sync**: Keep test environments in sync with production

### Monitoring

- Monitor E2E test execution times in CI/CD
- Track test failure rates and patterns
- Review performance trends over time
- Validate security coverage remains comprehensive