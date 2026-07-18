# Docker Runbook

This runbook explains how to build, verify, and run the production Docker image.

## Build (multi-stage standalone)
- docker build -t build-my-stack:latest .

## Verify security posture
- Non-root user: docker inspect build-my-stack:latest --format '{{json .Config.User}}'  # should be "1001:1001"
- HEALTHCHECK: docker inspect build-my-stack:latest --format '{{json .Config.Healthcheck}}'
- Secrets via *_FILE: entrypoint /entrypoint.sh loads envs from *_FILE

## Image size budget (< 350MB)
- docker image inspect build-my-stack:latest --format '{{.Size}}' | numfmt --to=iec

## Run locally
- cp .env.example .env.local  # set DATABASE_URL, NEXTAUTH_SECRET, etc.
- docker run --rm -p 3000:3000 --env-file .env.local build-my-stack:latest
- Health: curl -sf http://localhost:3000/api/health

## Logs & troubleshooting
- docker logs -f $(docker ps -q -f ancestor=build-my-stack:latest) 
- If Prisma fails: ensure DATABASE_URL is reachable from container

## Minimal secrets guidance
- Provide secrets through files and mount as read-only:
  - docker run -p 3000:3000 \
    -e NEXTAUTH_SECRET_FILE=/run/secrets/nextauth_secret \
    -v $(pwd)/secrets/nextauth_secret:/run/secrets/nextauth_secret:ro \
    build-my-stack:latest
