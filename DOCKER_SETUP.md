# 🐳 Docker Development Setup

## Übersicht

Build-My-Stack kann vollständig in Docker-Containern entwickelt werden. Diese Anleitung beschreibt die Einrichtung und Verwendung der Docker-Entwicklungsumgebung.

## Voraussetzungen

- Docker Desktop (>= 20.10.0)
- Docker Compose (>= 2.0.0)
- mindestens 4GB RAM für Docker
- mindestens 10GB freier Speicherplatz

## Schnellstart

### 1. Erstmaliges Setup

```bash
# Setup-Script ausführen (erstellt alle notwendigen Dateien und startet Services)
./docker/setup.sh

# ODER mit Makefile
make setup
```

Das Setup-Script:
- ✅ Prüft Docker Installation
- ✅ Erstellt `.env.docker` falls nicht vorhanden
- ✅ Erstellt notwendige Verzeichnisse
- ✅ Erstellt PostgreSQL Initialisierungs-Skripte
- ✅ Baut Docker Images
- ✅ Startet alle Services
- ✅ Wartet auf Bereitschaft aller Services

### 2. Services starten

```bash
# Alle Services starten
make up
# oder
docker-compose up -d

# Nur bestimmte Services
docker-compose up -d postgres redis
```

### 3. Logs ansehen

```bash
# Alle Logs
make logs

# Nur App Logs
make logs-app

# Nur Datenbank Logs
make logs-db
```

### 4. Services stoppen

```bash
# Alle Services stoppen
make down
# oder
docker-compose down

# Services stoppen und Volumes löschen
docker-compose down -v
```

## Services

### Next.js Application
- **Port:** 3000
- **URL:** http://localhost:3000
- **Container:** build-my-stack-app
- **Hot Reload:** ✅ Aktiviert

### PostgreSQL Database
- **Port:** 5432
- **Version:** 18.0 (alpine)
- **Database:** build_my_stack_dev
- **User:** postgres
- **Password:** postgres_dev_password
- **Container:** build-my-stack-postgres
- **Status:** ✅ Tested & Working

### Redis Cache
- **Port:** 6379
- **Version:** 7-alpine
- **Container:** build-my-stack-redis
- **Status:** ✅ Tested & Working

## Makefile Befehle

### Service Management
```bash
make up              # Services starten
make down            # Services stoppen
make restart         # Services neu starten
make restart-app     # Nur App neu starten
make status          # Service Status anzeigen
make health          # Health Check durchführen
make stats           # Resource Usage anzeigen
```

### Development
```bash
make shell           # Shell im App Container öffnen
make shell-db        # PostgreSQL Shell öffnen
make logs            # Alle Logs anzeigen
make logs-app        # Nur App Logs
make logs-db         # Nur DB Logs
```

### Database
```bash
make db-migrate      # Migrations ausführen
make db-seed         # Daten seeden
make db-reset        # DB zurücksetzen (migrate + seed)
make db-studio       # Prisma Studio öffnen
make backup-db       # Datenbank Backup erstellen
make restore-db      # Backup wiederherstellen
```

### Build & Test
```bash
make build           # App bauen
make build-docker    # Docker Images neu bauen
make test            # Tests ausführen
make test-watch      # Tests im Watch Mode
make test-coverage   # Tests mit Coverage
make lint            # Code linting
make lint-fix        # Linting Fehler beheben
make type-check      # TypeScript prüfen
make format          # Code formatieren
```

### Maintenance
```bash
make clean           # Container & Volumes löschen
make prune           # Ungenutzte Docker Resources entfernen
make install         # NPM Dependencies installieren
```

## Wichtige Dateien

### docker-compose.yml
Definiert alle Services und deren Konfiguration:
- Next.js App mit Hot Reload
- PostgreSQL mit Persistent Storage
- Redis für Caching
- DevTools Container (optional)

### .env.docker
Environment Variables für Docker-Umgebung:
```bash
# Datenbank
DATABASE_URL=postgresql://postgres:postgres_dev_password@postgres:5432/build_my_stack_dev

# Redis
REDIS_URL=redis://redis:6379

# NextAuth
NEXTAUTH_SECRET=dev-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

### Dockerfile.dev
Development Dockerfile mit:
- Node 22 Alpine
- Hot Reload Support
- Volume Mounts für Source Code
- Optimierte Layer Caching

## Volumes

### Persistent Volumes
```bash
build-my-stack-postgres-data    # PostgreSQL Daten
build-my-stack-redis-data       # Redis Daten
build-my-stack-node-modules     # NPM Packages
```

Volumes anzeigen:
```bash
docker volume ls | grep build-my-stack
```

Volumes löschen:
```bash
docker-compose down -v
```

## ✅ Getestet & Verifiziert

Die Docker-Umgebung wurde erfolgreich getestet am **2025-10-23**:

```bash
# Health Check erfolgreich
curl http://localhost:3000/api/health
{
  "status": "healthy",
  "database": {
    "version": "PostgreSQL 18.0",
    "connected": true
  }
}

# Alle Services healthy
docker-compose ps
NAME                      STATUS
build-my-stack-app        Up (healthy)
build-my-stack-postgres   Up (healthy)  
build-my-stack-redis      Up (healthy)

# Migrationen erfolgreich
npm run db:migrate
✅ 2 Migrationen angewendet
```

---

## Troubleshooting

### Port bereits belegt
```bash
# Prozess auf Port 3000 finden und beenden
lsof -ti:3000 | xargs kill -9

# ODER anderen Port verwenden
# In .env.docker: PORT=3001
```

### Datenbank Verbindungsfehler
```bash
# PostgreSQL Status prüfen
docker-compose exec postgres pg_isready -U postgres

# Logs prüfen
make logs-db

# Container neu starten
docker-compose restart postgres
```

### Build Fehler
```bash
# Clean Build
make clean
make setup-clean

# Docker Cache leeren
docker builder prune -a
```

### Hot Reload funktioniert nicht
```bash
# Polling aktivieren (bereits in .env.docker)
WATCHPACK_POLLING=true
CHOKIDAR_USEPOLLING=true

# App neu starten
make restart-app
```

### Out of Memory
```bash
# Docker Desktop Memory erhöhen
# Settings > Resources > Advanced > Memory: 4GB+

# Oder Services einzeln starten
docker-compose up -d postgres redis
docker-compose up -d app
```

## Performance Tipps

### 1. Volume Caching
Bereits konfiguriert mit `:cached` flag für Mac/Windows:
```yaml
volumes:
  - ./src:/app/src:cached
```

### 2. Node Modules als Volume
```yaml
volumes:
  - node_modules:/app/node_modules
```
Verhindert langsame File-System Operationen.

### 3. .dockerignore
```
node_modules
.next
.git
coverage
```

### 4. Multi-Stage Builds
Für Production Builds (siehe Dockerfile).

## Migration von lokaler Entwicklung

### 1. Lokale Services stoppen
```bash
# Wenn lokal PostgreSQL/Redis läuft
brew services stop postgresql
brew services stop redis
```

### 2. .env.docker anpassen
```bash
# Kopiere lokale .env zu .env.docker
cp .env .env.docker

# Passe DATABASE_URL an
DATABASE_URL=postgresql://postgres:postgres_dev_password@postgres:5432/build_my_stack_dev
```

### 3. Daten migrieren (optional)
```bash
# Backup von lokaler DB
pg_dump build_my_stack_dev > backup.sql

# In Docker Container importieren
make restore-db BACKUP_FILE=backup.sql
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Build & Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: docker-compose up -d
      - name: Wait for app
        run: |
          timeout 60 sh -c 'until curl -f http://localhost:3000/api/health; do sleep 2; done'
      - name: Run tests
        run: make test
      - name: Stop services
        run: docker-compose down -v
```

## Best Practices

### Development Workflow
1. **Starte Services:** `make up`
2. **Entwickle:** Code Änderungen werden automatisch geladen
3. **Tests:** `make test`
4. **Migrations:** `make db-migrate`
5. **Commit:** Git commit mit allen Änderungen
6. **Stop:** `make down` (oder über Nacht laufen lassen)

### Datenpersistenz
- Verwende `make down` statt `docker-compose down -v`
- Volumes bleiben bestehen bei Container Neustarts
- Für Clean State: `make setup-clean`

### Security
- `.env.docker` sollte in `.gitignore` sein
- Produktions-Secrets NIEMALS committen
- Verwende Docker Secrets für Production

## Weitere Ressourcen

- [Docker Compose Dokumentation](https://docs.docker.com/compose/)
- [Next.js in Docker](https://nextjs.org/docs/deployment#docker-image)
- [Prisma mit Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)

---

**Hilfe benötigt?** Öffne ein Issue oder siehe `make help` für alle Befehle.
