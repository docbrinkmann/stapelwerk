// Simple health check script for Docker HEALTHCHECK
// This script makes an HTTP request to the health endpoint
// and exits with 0 (success) or 1 (failure)

const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000,
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0); // Healthy
  } else {
    console.error(`Health check failed with status code: ${res.statusCode}`);
    process.exit(1); // Unhealthy
  }
});

req.on('error', (error) => {
  console.error(`Health check failed with error: ${error.message}`);
  process.exit(1); // Unhealthy
});

req.on('timeout', () => {
  console.error('Health check timed out');
  req.destroy();
  process.exit(1); // Unhealthy
});

req.end();
