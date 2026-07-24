# Docker Development Environment

This directory contains Docker configuration files for running the stapelwerk application in a containerized development environment.

## Quick Start

1. **Start the development environment:**
   ```bash
   npm run docker:up
   ```

2. **Access the application:**
   - Application: http://localhost:3000
   - Database: localhost:5432
   - Redis: localhost:6379

3. **Stop the development environment:**
   ```bash
   npm run docker:down
   ```

## Services

### App Service
- **Container**: `stapelwerk-app`
- **Port**: 3000
- **Hot Reloading**: Enabled with volume mounts
- **Environment**: Development with all debugging features

### PostgreSQL Service
- **Container**: `stapelwerk-postgres`
- **Port**: 5432
- **Database**: `build_my_stack_dev`
- **Test Database**: `build_my_stack_test`
- **User**: `postgres`
- **Password**: `postgres_dev_password`

### Redis Service
- **Container**: `stapelwerk-redis`
- **Port**: 6379
- **Persistence**: Enabled with volume mounts

### DevTools Service (Optional)
- **Container**: `stapelwerk-devtools`
- **Purpose**: Development utilities and debugging
- **Profile**: `tools` (start with `docker-compose --profile tools up`)

## Volume Mounts

### Source Code (Hot Reloading)
- `./src` → `/app/src`
- `./public` → `/app/public`
- `./prisma` → `/app/prisma`

### Configuration Files
- `./package.json` → `/app/package.json`
- `./tsconfig.json` → `/app/tsconfig.json`
- `./next.config.js` → `/app/next.config.js`
- `./.env.docker` → `/app/.env.local`

### Performance Volumes
- `node_modules` (named volume for faster installs)
- `/app/.next` (excluded for optimal rebuilds)

## Environment Variables

The development environment uses `.env.docker` for configuration:

### Database
```env
DATABASE_URL=postgresql://postgres:postgres_dev_password@postgres:5432/build_my_stack_dev
DATABASE_TEST_URL=postgresql://postgres:postgres_dev_password@postgres:5432/build_my_stack_test
```

### Hot Reloading
```env
WATCHPACK_POLLING=true
CHOKIDAR_USEPOLLING=true
HOST=0.0.0.0
```

### Development Features
```env
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_DEBUG_MODE=true
```

## Development Workflow

### Initial Setup
```bash
# Build and start all services
npm run docker:up

# Run database migrations
npm run docker:db:migrate

# Generate Prisma client
npm run docker:db:generate
```

### Daily Development
```bash
# Start development environment
npm run docker:up

# View logs
npm run docker:logs

# Run tests in container
npm run docker:test

# Stop environment
npm run docker:down
```

### Database Management
```bash
# Run migrations
npm run docker:db:migrate

# Reset database
npm run docker:db:reset

# Open Prisma Studio
npm run docker:db:studio
```

## Hot Reloading

Hot reloading is configured for optimal Docker development:

- **File Watching**: Uses polling for Docker compatibility
- **Volume Mounts**: Source code is mounted for instant updates
- **Next.js Config**: Optimized webpack configuration for containers
- **Performance**: node_modules preserved as named volume

## Debugging

### Container Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f postgres
```

### Shell Access
```bash
# Access app container
docker-compose exec app sh

# Access database
docker-compose exec postgres psql -U postgres -d build_my_stack_dev

# Access Redis
docker-compose exec redis redis-cli
```

### Development Tools
```bash
# Start with development tools
docker-compose --profile tools up

# Access development tools container
docker-compose exec devtools sh
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   
   # Stop conflicting processes or change ports in docker-compose.yml
   ```

2. **Permission Issues**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

3. **Hot Reloading Not Working**
   - Ensure `WATCHPACK_POLLING=true` in `.env.docker`
   - Check volume mounts in `docker-compose.yml`
   - Verify Next.js config has polling enabled

4. **Database Connection Issues**
   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U postgres -d build_my_stack_dev
   
   # View database logs
   docker-compose logs postgres
   ```

5. **Slow Performance**
   - Use named volumes for `node_modules`
   - Ensure `.dockerignore` excludes unnecessary files
   - Consider using cached volume mounts

### Clean Reset
```bash
# Stop all services
npm run docker:down

# Remove volumes (WARNING: This deletes data)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Full rebuild
npm run docker:build
npm run docker:up
```

## Security Notes

- The `.env.docker` file contains development credentials only
- Never use these credentials in production
- Database passwords are intentionally simple for development
- All services are exposed on localhost for development convenience

## Performance Optimization

- Named volumes for `node_modules` (faster installs)
- Cached volume mounts for frequently accessed files
- Excluded directories in `.dockerignore`
- Optimized Next.js webpack configuration
- Health checks for service readiness