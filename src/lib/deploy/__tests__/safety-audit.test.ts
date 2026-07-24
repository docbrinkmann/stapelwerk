import { describe, it, expect } from 'vitest';
import {
  auditCompose,
  portIsExposed,
  parsePortEntry,
  imageTag,
  type SafetyAuditVerdict,
} from '../safety-audit';

/** Find a property's status in an audit verdict. */
function propStatus(v: SafetyAuditVerdict, id: string) {
  return v.properties.find((p) => p.id === id)?.status;
}

describe('parsePortEntry', () => {
  it('flags all-interface publishes and passes loopback binds', () => {
    expect(portIsExposed('5432:5432')).toBe(true); // HOST:CONTAINER on 0.0.0.0
    expect(portIsExposed('5432')).toBe(true); // bare container port, ephemeral host
    expect(portIsExposed('5432:5432/tcp')).toBe(true); // proto suffix
    expect(portIsExposed('127.0.0.1:5432:5432')).toBe(false); // loopback bind
    expect(portIsExposed('localhost:5432:5432')).toBe(false);
    expect(portIsExposed('0.0.0.0:5432:5432')).toBe(true); // explicit all-interfaces
    expect(portIsExposed('[::1]:6379:6379')).toBe(false); // IPv6 loopback (bracketed)
    expect(portIsExposed({ published: 5432, target: 5432 })).toBe(true); // long form
    expect(portIsExposed({ published: 5432, target: 5432, host_ip: '127.0.0.1' })).toBe(false);
  });

  it('extracts the container-side port from every form', () => {
    expect(parsePortEntry('8080:5432').containerPort).toBe(5432); // remapped host port
    expect(parsePortEntry('5432').containerPort).toBe(5432);
    expect(parsePortEntry('127.0.0.1:5432:5432').containerPort).toBe(5432);
    expect(parsePortEntry('[::1]:6379:6379').containerPort).toBe(6379);
    expect(parsePortEntry({ published: 8080, target: 5432 }).containerPort).toBe(5432);
    expect(parsePortEntry('5432:5432/tcp').containerPort).toBe(5432);
  });
});

describe('imageTag', () => {
  it('extracts the tag or null, ignoring registry host and digest', () => {
    expect(imageTag('postgres:18-alpine')).toBe('18-alpine');
    expect(imageTag('postgres')).toBeNull();
    expect(imageTag('ghcr.io/org/app:1.2.3')).toBe('1.2.3'); // colon in registry host is not the tag
    expect(imageTag('nginx:latest')).toBe('latest');
    expect(imageTag('postgres@sha256:abc')).toBeNull(); // digest is not a tag
  });
});

describe('auditCompose — exposed datastore port', () => {
  it('fails when a datastore publishes a port to a non-loopback interface', () => {
    const v = auditCompose({
      services: { db: { image: 'postgres:18-alpine', ports: ['5432:5432'], volumes: ['d:/var/lib/postgresql/data'] } },
    });
    expect(propStatus(v, 'exposed-datastore-port')).toBe('fail');
    expect(v.status).toBe('fail');
  });

  it('passes when the datastore port is loopback-bound or not published', () => {
    expect(propStatus(auditCompose({
      services: { db: { image: 'postgres:18-alpine', ports: ['127.0.0.1:5432:5432'], volumes: ['d:/x'] } },
    }), 'exposed-datastore-port')).toBe('pass');
    expect(propStatus(auditCompose({
      services: { db: { image: 'postgres:18-alpine', volumes: ['d:/x'] } }, // no ports at all
    }), 'exposed-datastore-port')).toBe('pass');
  });

  it('passes (checked, none exposed) when no published port is a datastore port', () => {
    const v = auditCompose({ services: { web: { image: 'nginx:1.27', ports: ['80:80'] } } });
    expect(propStatus(v, 'exposed-datastore-port')).toBe('pass');
  });

  it('catches an UNRECOGNISED datastore by its port (regression: red-team false negative)', () => {
    // CockroachDB image name is not in any substring list — port 26257 is.
    const v = auditCompose({ services: { db: { image: 'cockroachdb/cockroach:v23', ports: ['26257:26257'] } } });
    expect(propStatus(v, 'exposed-datastore-port')).toBe('fail');
    expect(v.status).toBe('fail');
  });

  it('does NOT flag an admin UI whose name contains a datastore substring (regression: false positive)', () => {
    // mongo-express publishes its own UI port 8081, not 27017 → not a datastore port.
    const v = auditCompose({ services: { ui: { image: 'mongo-express:1.0', ports: ['8081:8081'] } } });
    expect(propStatus(v, 'exposed-datastore-port')).toBe('pass');
  });
});

describe('auditCompose — stateful without volume', () => {
  it('fails a persistent datastore that has no volume', () => {
    const v = auditCompose({ services: { db: { image: 'postgres:18-alpine' } } });
    expect(propStatus(v, 'stateful-no-volume')).toBe('fail');
  });

  it('passes when the datastore has a volume', () => {
    const v = auditCompose({ services: { db: { image: 'postgres:18-alpine', volumes: ['pgdata:/var/lib/postgresql/data'] } } });
    expect(propStatus(v, 'stateful-no-volume')).toBe('pass');
  });

  it('excludes caches (redis) — ephemeral is a valid choice', () => {
    const v = auditCompose({ services: { cache: { image: 'redis:7-alpine' } } });
    expect(propStatus(v, 'stateful-no-volume')).toBe('not-applicable');
  });

  it('excludes stateless admin UIs (regression: mongo-express is not a data-losing store)', () => {
    const v = auditCompose({ services: { ui: { image: 'mongo-express:1.0' } } });
    expect(propStatus(v, 'stateful-no-volume')).toBe('not-applicable');
  });

  it('catches an unrecognised persistent store with no volume (cockroach)', () => {
    const v = auditCompose({ services: { db: { image: 'cockroachdb/cockroach:v23' } } });
    expect(propStatus(v, 'stateful-no-volume')).toBe('fail');
  });
});

describe('auditCompose — weak secret', () => {
  it('fails empty or known-default secret values', () => {
    expect(propStatus(auditCompose({
      services: { db: { image: 'postgres:18', environment: { POSTGRES_PASSWORD: 'change_me' } } },
    }), 'weak-secret')).toBe('fail');
    expect(propStatus(auditCompose({
      services: { db: { image: 'postgres:18', environment: ['POSTGRES_PASSWORD='] } }, // list form, empty
    }), 'weak-secret')).toBe('fail');
  });

  it('warns on short values and passes strong ones', () => {
    expect(propStatus(auditCompose({
      services: { db: { image: 'postgres:18', environment: { DB_PASSWORD: 'short' } } },
    }), 'weak-secret')).toBe('warn');
    expect(propStatus(auditCompose({
      services: { db: { image: 'postgres:18', environment: { DB_PASSWORD: 'Xk9-mQ2pLw7Z_aB3' } } },
    }), 'weak-secret')).toBe('pass');
  });

  it('skips masked values (cannot judge) and non-secret keys', () => {
    const v = auditCompose({
      services: { db: { image: 'postgres:18', environment: { POSTGRES_PASSWORD: '<secret>', POSTGRES_USER: 'app' } } },
    });
    expect(propStatus(v, 'weak-secret')).toBe('not-applicable');
  });

  it('catches secret-shaped keys beyond PASSWORD (regression: ENCRYPTION_KEY / SALT)', () => {
    expect(propStatus(auditCompose({
      services: { app: { image: 'app:1', environment: { ENCRYPTION_KEY: 'changeme' } } },
    }), 'weak-secret')).toBe('fail');
    expect(propStatus(auditCompose({
      services: { app: { image: 'app:1', environment: { SESSION_SALT: 'secret' } } },
    }), 'weak-secret')).toBe('fail');
    // A word that merely contains "key" (no separator) is not treated as a secret.
    expect(propStatus(auditCompose({
      services: { app: { image: 'app:1', environment: { MONKEY_MODE: 'on' } } },
    }), 'weak-secret')).toBe('not-applicable');
  });
});

describe('auditCompose — unpinned image', () => {
  it('warns on :latest and untagged images, passes pinned', () => {
    expect(propStatus(auditCompose({ services: { a: { image: 'nginx:latest' } } }), 'unpinned-image')).toBe('warn');
    expect(propStatus(auditCompose({ services: { a: { image: 'nginx' } } }), 'unpinned-image')).toBe('warn');
    expect(propStatus(auditCompose({ services: { a: { image: 'nginx:1.27-alpine' } } }), 'unpinned-image')).toBe('pass');
  });
});

describe('auditCompose — roll-up', () => {
  it('is pass for a clean stack and lists no failures', () => {
    const v = auditCompose({
      services: {
        db: { image: 'postgres:18-alpine', volumes: ['d:/var/lib/postgresql/data'], environment: { POSTGRES_PASSWORD: 'Xk9-mQ2pLw7Z_aB3' } },
        web: { image: 'nginx:1.27-alpine' },
      },
    });
    expect(v.status).toBe('pass');
    expect(v.summary).toMatch(/Deploy-safe by construction/);
    expect(v.summary).toMatch(/Verified:/);
  });

  it('honest summary: never claims a property that was not-applicable (regression)', () => {
    // Only nginx — no datastore, no inline secret. Must NOT assert "datastores
    // persist" or "no default secrets"; those go under "Not present".
    const v = auditCompose({ services: { web: { image: 'nginx:1.27-alpine' } } });
    expect(v.status).toBe('pass');
    expect(v.summary).toMatch(/Not present \(not checked\)/);
    expect(v.summary).toContain('Datastores keep their data (persistent volumes)'); // listed as not-present
    // The "Verified:" clause must only contain the checks that actually ran.
    const verifiedClause = v.summary.split('Not present')[0];
    expect(verifiedClause).not.toContain('Datastores keep their data');
  });

  it('fail beats warn in the overall roll-up', () => {
    const v = auditCompose({
      services: {
        db: { image: 'postgres:latest', ports: ['5432:5432'] }, // fail (exposed + no volume) AND warn (latest)
      },
    });
    expect(v.status).toBe('fail');
  });

  it('handles an empty/garbage compose without throwing', () => {
    expect(auditCompose({}).status).toBe('pass');
    expect(auditCompose(null).status).toBe('pass');
  });
});
