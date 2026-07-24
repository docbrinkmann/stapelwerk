import { describe, it, expect, beforeEach } from 'vitest';
import { useStackBuilderStore } from '../stack-builder';

// Regression: the community marketplace imports RAW catalog services (no
// configuration). importFromJSON used to persist them as-is, corrupting the
// draft — the builder then crashed on load reading configuration.dependsOn.
describe('Stack Builder Store — importFromJSON', () => {
  beforeEach(() => {
    useStackBuilderStore.getState().clearStack();
  });

  it('normalizes raw catalog services into builder shape with a default configuration', () => {
    useStackBuilderStore.getState().importFromJSON(
      JSON.stringify({
        name: 'Demo (imported)',
        description: 'from the marketplace',
        services: [
          {
            id: 1,
            name: 'Nextcloud',
            slug: 'nextcloud',
            ports: [{ containerPort: 80 }],
            // API rows carry the relation as `categories` — the builder needs `category`.
            categories: { name: 'Productivity', slug: 'productivity' },
          },
          { id: 2, name: 'PostgreSQL', slug: 'postgresql' },
        ],
      }),
    );

    const state = useStackBuilderStore.getState();
    expect(state.services).toHaveLength(2);
    for (const s of state.services) {
      expect(s.service).toBeTruthy();
      expect(s.configuration).toBeTruthy();
      expect(Array.isArray(s.configuration.dependsOn)).toBe(true);
    }
    expect(state.services[0].serviceId).toBe(1);
    expect(state.services[0].configuration.portMappings).toEqual([
      { containerPort: 80, hostPort: 80 },
    ]);
    // categories (API relation) mapped onto the builder's `category` shape.
    expect(state.services[0].service.category).toEqual({
      id: 0,
      name: 'Productivity',
      slug: 'productivity',
    });
  });

  it('keeps full builder-shaped entries (exportAsJSON round-trip) intact', () => {
    const full = {
      id: 'stack-service-9-abc',
      serviceId: 9,
      order: 0,
      service: { id: 9, name: 'Redis', slug: 'redis' },
      configuration: {
        environmentVariables: { FOO: 'bar' },
        portMappings: [{ containerPort: 6379, hostPort: 6380 }],
        volumeMounts: [],
        dependsOn: [],
      },
    };
    useStackBuilderStore.getState().importFromJSON(
      JSON.stringify({ name: 'RT', services: [full] }),
    );

    const s = useStackBuilderStore.getState().services[0];
    expect(s.id).toBe(full.id);
    expect(s.configuration.environmentVariables).toEqual({ FOO: 'bar' });
    expect(s.configuration.portMappings).toEqual([{ containerPort: 6379, hostPort: 6380 }]);
  });
});
