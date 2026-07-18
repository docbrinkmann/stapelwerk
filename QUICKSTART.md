# ⚡ Quick Start Guide

## 🚀 Schnellstart in 3 Minuten

### 1. Docker Setup
```bash
./docker/setup.sh
```

### 2. App öffnen
```bash
open http://localhost:3000
```

### 3. Datenbank initialisieren
```bash
make db-migrate
make db-seed
```

**Fertig!** Die App läuft jetzt lokal. 🎉

---

## 📋 Die 10 wichtigsten Commands

```bash
make up              # Services starten
make down            # Services stoppen
make logs-app        # App Logs anzeigen
make shell           # Shell im Container öffnen
make db-migrate      # Migrations ausführen
make db-seed         # Test Daten laden
make restart-app     # App neu starten
make health          # Health Check aller Services
make test            # Tests ausführen
make help            # Alle Commands anzeigen
```

---

## 📁 Wichtige Dateien

| Datei | Beschreibung |
|-------|--------------|
| `SUMMARY.md` | 📋 Vollständige Übersicht aller Änderungen |
| `CHANGELOG_BUILD_FIXES.md` | 🔧 Detaillierte Build Fixes |
| `DOCKER_SETUP.md` | 🐳 Docker Anleitung |
| `Makefile` | ⚙️ Development Commands |
| `.env.docker` | 🔐 Docker Environment Variables |

---

## 🆘 Hilfe

```bash
# Logs prüfen
make logs-app

# Health Check
make health

# Alles neu starten
make clean
make setup
```

Mehr Details: Siehe `SUMMARY.md` und `DOCKER_SETUP.md`

---

**Status:** ✅ Build erfolgreich | 🐳 Docker Deployed & Tested | 🚀 Development Ready

---

## ✅ Getestet & Verifiziert (2025-10-23)

```bash
# PostgreSQL 18.0 läuft
docker-compose exec postgres psql -U postgres -c "SELECT version();"
# PostgreSQL 18.0 on aarch64-unknown-linux-musl

# App ist healthy
curl http://localhost:3000/api/health | jq '.status'
# "healthy"

# Alle Services up
docker-compose ps
# All services: Up (healthy)
```
