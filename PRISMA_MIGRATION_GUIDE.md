# Prisma Migration Guide: UserSession Model

**Ziel:** Hinzufügen des `UserSession` Modells zur Datenbank für Enterprise User Management

**Datum:** 23. Oktober 2025  
**Status:** 🔄 Bereit zur Ausführung

---

## 📋 Überblick

Dieses Dokument beschreibt die Schritte zum Hinzufügen des `UserSession` Modells zum Prisma Schema und zur Datenbank.

### Was wird hinzugefügt?

Das `UserSession` Model ermöglicht:
- ✅ NextAuth Session Management
- ✅ Enterprise User Management Integration
- ✅ Organization Context Tracking
- ✅ Security & Device Info Tracking
- ✅ Performance-optimierte Indizes

---

## 🗂️ Schema Details

### UserSession Model

```prisma
model UserSession {
  id                   String   @id @default(cuid())
  sessionToken         String   @unique
  userId               String
  organizationContext  Json     // Stores OrganizationContext object
  expiresAt            DateTime
  lastActivity         DateTime
  ipAddress            String
  userAgent            String
  isActive             Boolean  @default(true)
  
  // Device Info (stored as JSON)
  deviceInfo           Json
  
  // Security Flags (stored as JSON)
  securityFlags        Json
  
  // Additional metadata
  metadata             Json?
  
  // Timestamps
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  
  // Indexes for Performance
  @@index([userId])
  @@index([sessionToken])
  @@index([expiresAt])
  @@index([isActive])
  @@map("user_sessions")
}
```

### Felder Erklärung

| Feld | Typ | Beschreibung | Nullable |
|------|-----|--------------|----------|
| `id` | String (cuid) | Eindeutige Session-ID | ❌ |
| `sessionToken` | String (unique) | NextAuth Session Token | ❌ |
| `userId` | String | User ID Referenz | ❌ |
| `organizationContext` | Json | Enterprise Org Context | ❌ |
| `expiresAt` | DateTime | Session Ablaufzeit | ❌ |
| `lastActivity` | DateTime | Letzte Aktivität | ❌ |
| `ipAddress` | String | Client IP | ❌ |
| `userAgent` | String | Browser/Client Info | ❌ |
| `isActive` | Boolean | Session Status | ❌ (default: true) |
| `deviceInfo` | Json | Device Details | ❌ |
| `securityFlags` | Json | Security Metadata | ❌ |
| `metadata` | Json | Zusätzliche Daten | ✅ (optional) |
| `createdAt` | DateTime | Erstellzeitpunkt | ❌ (auto) |
| `updatedAt` | DateTime | Update-Zeitpunkt | ❌ (auto) |

### Indizes (Performance)

```sql
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");
CREATE INDEX "user_sessions_sessionToken_idx" ON "user_sessions"("sessionToken");
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");
CREATE INDEX "user_sessions_isActive_idx" ON "user_sessions"("isActive");
CREATE UNIQUE INDEX "user_sessions_sessionToken_key" ON "user_sessions"("sessionToken");
```

**Begründung:**
- `userId`: Häufige Abfrage nach User-Sessions
- `sessionToken`: Eindeutiger Token-Lookup
- `expiresAt`: Cleanup-Queries für abgelaufene Sessions
- `isActive`: Filterung aktiver Sessions

---

## 🚀 Migrations-Schritte

### Schritt 1: Prisma Schema validieren

```bash
cd /Users/sebastian/projects/build-my-stack

# Schema validieren
npx prisma validate
```

**Erwartete Ausgabe:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Schema validation successful!
```

---

### Schritt 2: Prisma Migration erstellen

```bash
# Migration mit beschreibendem Namen erstellen
npx prisma migrate dev --name add_user_session_model

# Alternative für Production:
# npx prisma migrate deploy
```

**Erwartete Ausgabe:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "your_database", schema "public" at "localhost:5432"

Applying migration `20251023_add_user_session_model`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20251023XXXXXX_add_user_session_model/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

---

### Schritt 3: Prisma Client regenerieren

```bash
# Client neu generieren (normalerweise automatisch nach Migration)
npx prisma generate
```

**Erwartete Ausgabe:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma

✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

---

### Schritt 4: Migration SQL überprüfen

```bash
# Letzte Migration anzeigen
cat prisma/migrations/$(ls -t prisma/migrations | head -1)/migration.sql
```

**Erwartete SQL:**
```sql
-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationContext" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deviceInfo" JSONB NOT NULL,
    "securityFlags" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_sessionToken_key" ON "user_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_sessionToken_idx" ON "user_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "user_sessions_isActive_idx" ON "user_sessions"("isActive");
```

---

### Schritt 5: Datenbank Verbindung testen

```bash
# Prisma Studio öffnen (optional)
npx prisma studio

# Oder direkte DB-Abfrage
npx prisma db pull --print
```

---

### Schritt 6: Build testen

```bash
# TypeScript Build
npm run build

# Erwartung: Sollte jetzt ohne UserSession Fehler kompilieren
```

---

## ⚠️ Rollback-Plan

Falls die Migration fehlschlägt oder rückgängig gemacht werden muss:

### Option 1: Migration zurücksetzen (Development)

```bash
# Letzte Migration rückgängig machen
npx prisma migrate reset

# Warnung: Löscht ALLE Daten!
```

### Option 2: Spezifische Migration rückgängig (Production-safe)

```bash
# 1. Migration-Ordner finden
ls -la prisma/migrations/

# 2. Migration-Ordner löschen
rm -rf prisma/migrations/20251023XXXXXX_add_user_session_model

# 3. Schema zurücksetzen (UserSession Model aus schema.prisma entfernen)

# 4. Neue Migration erstellen
npx prisma migrate dev --name remove_user_session_model
```

### Option 3: Manuelles SQL Rollback

```sql
-- In psql oder pgAdmin ausführen:

-- Indizes löschen
DROP INDEX IF EXISTS "user_sessions_userId_idx";
DROP INDEX IF EXISTS "user_sessions_sessionToken_idx";
DROP INDEX IF EXISTS "user_sessions_expiresAt_idx";
DROP INDEX IF EXISTS "user_sessions_isActive_idx";
DROP INDEX IF EXISTS "user_sessions_sessionToken_key";

-- Tabelle löschen
DROP TABLE IF EXISTS "user_sessions";
```

---

## 🧪 Test-Queries

Nach erfolgreicher Migration:

### Test 1: Session erstellen

```typescript
// src/__tests__/user-session.test.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSessionCreation() {
  const session = await prisma.userSession.create({
    data: {
      sessionToken: 'test-token-' + Date.now(),
      userId: 'test-user-123',
      organizationContext: {
        organizationId: 'org-123',
        role: 'member',
        permissions: ['read', 'write']
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      lastActivity: new Date(),
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Test',
      deviceInfo: {
        platform: 'MacOS',
        browser: 'Chrome'
      },
      securityFlags: {
        mfaVerified: true,
        trustedDevice: false
      }
    }
  });

  console.log('✅ Session created:', session.id);
  return session;
}

testSessionCreation().catch(console.error);
```

### Test 2: Session abrufen

```typescript
async function testSessionRetrieval(sessionToken: string) {
  const session = await prisma.userSession.findUnique({
    where: { sessionToken }
  });

  console.log('✅ Session found:', session?.id);
  return session;
}
```

### Test 3: Aktive Sessions zählen

```typescript
async function testActiveSessionsCount(userId: string) {
  const count = await prisma.userSession.count({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() }
    }
  });

  console.log(`✅ Active sessions for user ${userId}:`, count);
  return count;
}
```

---

## 📊 Performance Monitoring

### Wichtige Queries zu monitoren

```sql
-- 1. Häufigste Query: Session Lookup by Token
EXPLAIN ANALYZE
SELECT * FROM user_sessions
WHERE "sessionToken" = 'some-token';

-- 2. Session Cleanup (Expired Sessions)
EXPLAIN ANALYZE
SELECT * FROM user_sessions
WHERE "expiresAt" < NOW()
  AND "isActive" = true;

-- 3. User Active Sessions
EXPLAIN ANALYZE
SELECT * FROM user_sessions
WHERE "userId" = 'some-user-id'
  AND "isActive" = true
  AND "expiresAt" > NOW();
```

### Index Usage prüfen

```sql
-- PostgreSQL Index Usage Stats
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'user_sessions'
ORDER BY idx_scan DESC;
```

---

## 🔒 Security Considerations

### Sensitive Data

Das `UserSession` Model speichert sensitive Daten:

| Feld | Sensitivität | Empfehlung |
|------|--------------|------------|
| `sessionToken` | 🔴 Hoch | Niemals loggen! |
| `ipAddress` | 🟡 Mittel | Anonymisieren in Logs |
| `userAgent` | 🟢 Niedrig | OK zu loggen |
| `organizationContext` | 🟡 Mittel | Business-relevant, vorsichtig behandeln |
| `securityFlags` | 🔴 Hoch | Niemals nach außen exponieren |

### Empfohlene Maßnahmen

```typescript
// ✅ Gut: Session ohne sensible Daten
function sanitizeSession(session: UserSession) {
  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    isActive: session.isActive
    // sessionToken, ipAddress, securityFlags NICHT einschließen
  };
}

// ❌ Schlecht: Vollständige Session nach außen
app.get('/api/session', (req, res) => {
  const session = await prisma.userSession.findUnique(...);
  res.json(session); // Exponiert sessionToken!
});
```

---

## 📈 Maintenance

### Session Cleanup Job

Empfohlene Implementation eines Cleanup-Jobs:

```typescript
// src/lib/jobs/session-cleanup.ts
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

const prisma = new PrismaClient();

export function startSessionCleanupJob() {
  // Täglich um 2 Uhr abgelaufene Sessions löschen
  cron.schedule('0 2 * * *', async () => {
    try {
      const result = await prisma.userSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { 
              isActive: false,
              updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 Tage alt
            }
          ]
        }
      });

      console.log(`✅ Cleaned up ${result.count} expired sessions`);
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
    }
  });

  console.log('✅ Session cleanup job started (daily at 2 AM)');
}
```

---

## 🐛 Troubleshooting

### Problem 1: Migration schlägt fehl

**Symptom:**
```
Error: P3009
The migration cannot be applied cleanly to the database.
```

**Lösung:**
```bash
# Option A: Shadow Database Problem
# In .env:
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb?schema=public"

# Option B: Manuelle SQL-Anwendung
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > manual_migration.sql

# SQL manuell in DB ausführen
psql -U postgres -d mydb -f manual_migration.sql
```

### Problem 2: Prisma Client Type nicht aktualisiert

**Symptom:**
```typescript
Property 'userSession' does not exist on type 'PrismaClient'
```

**Lösung:**
```bash
# 1. node_modules/@prisma löschen
rm -rf node_modules/@prisma

# 2. Client neu generieren
npx prisma generate

# 3. TypeScript Server neu starten (VSCode)
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Problem 3: Unique Constraint Violations

**Symptom:**
```
Error: Unique constraint failed on the fields: (`sessionToken`)
```

**Lösung:**
```typescript
// Token Generierung verbessern
import { randomBytes } from 'crypto';

function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
```

---

## ✅ Verification Checklist

Nach der Migration:

- [ ] `npx prisma validate` erfolgreich
- [ ] `npx prisma migrate status` zeigt "Database is up to date"
- [ ] `npx prisma generate` ohne Fehler
- [ ] TypeScript Build erfolgreich (`npm run build`)
- [ ] Prisma Studio zeigt `user_sessions` Tabelle
- [ ] Test-Session kann erstellt werden
- [ ] Test-Session kann abgerufen werden
- [ ] Indizes sind aktiv (siehe Performance Monitoring)
- [ ] Application Server startet ohne Fehler

---

## 📝 Next Steps nach Migration

1. **Unit Tests schreiben** für SessionManagementService
2. **Integration Tests** für NextAuth Callbacks
3. **Session Cleanup Job** implementieren
4. **Monitoring** einrichten (Session Counts, Cleanup Stats)
5. **Documentation** für Team aktualisieren

---

## 📚 Referenzen

- [Prisma Migration Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL JSON/JSONB Types](https://www.postgresql.org/docs/current/datatype-json.html)
- [NextAuth Database Adapters](https://next-auth.js.org/adapters/overview)

---

**Dokument-Version:** 1.0  
**Letztes Update:** 23. Oktober 2025, 10:30 UTC  
**Nächste Review:** Nach erfolgreicher Migration
