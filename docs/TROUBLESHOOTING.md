# Troubleshooting Guide

Common issues and fixes for production deployments.

- Secrets not mounted
  - Ensure Docker Swarm is initialized: `docker swarm init`
  - Recreate secrets: `docker secret rm db_password && docker secret create db_password secrets/db_password.txt` (repeat for others)

- Nginx 502/Bad Gateway
  - Check app container: `docker service ls | grep stapelwerk`
  - Verify app health: `curl -I http://localhost:8080/health`
  - Validate nginx config: `docker exec stapelwerk-nginx-prod nginx -t`

- SSL issues
  - Generate self-signed certs under docker/certs (see implementation report)
  - Check mounts in docker-compose.prod.yml

- Database connection failures
  - Verify secret: `docker exec $(docker ps -q -f name=stapelwerk-ai) cat /run/secrets/db_password`
  - Check Postgres: `docker ps | grep postgres` and `pg_isready`

- Grafana/Prometheus not reachable
  - Prometheus: `curl http://localhost:9090/-/healthy`
  - Grafana: `curl http://localhost:3000/api/health`

- CORS blocked
  - Update CORS_ALLOWED_ORIGINS in env or reverse proxy rules in nginx.conf

- Rollback
  - See .github/workflows/deploy.yml rollback job for Vercel alias rollback steps
