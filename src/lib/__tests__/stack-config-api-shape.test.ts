import { describe, it, expect } from 'vitest'
import { stackConfigToApiShape } from '../stack-persistence'

// The API schema (stacks router) enforces the RECORD shape via z.record; the
// builder holds the ARRAY shape. This converter is the single bridge both save
// paths use — savePermanently used to send the array shape verbatim and 400.
describe('stackConfigToApiShape', () => {
  it('converts the builder array shape to the API record shape', () => {
    expect(
      stackConfigToApiShape({
        environmentVariables: { FOO: 'bar' },
        portMappings: [{ containerPort: 80, hostPort: 8080, protocol: 'tcp' }],
        volumeMounts: [{ containerPath: '/data', hostPath: '/srv/data', readOnly: false }],
        dependsOn: [{ serviceId: 1 }],
      }),
    ).toEqual({
      environmentVariables: { FOO: 'bar' },
      portMappings: { '80': '8080' },
      volumeMounts: { '/data': '/srv/data' },
      dependsOn: ['1'],
    })
  })

  it('is idempotent on already-record input', () => {
    expect(
      stackConfigToApiShape({
        environmentVariables: {},
        portMappings: { '443': '8443' } as never,
        volumeMounts: { '/etc': '/host/etc' } as never,
        dependsOn: ['2'] as never,
      }),
    ).toEqual({
      environmentVariables: {},
      portMappings: { '443': '8443' },
      volumeMounts: { '/etc': '/host/etc' },
      dependsOn: ['2'],
    })
  })

  it('tolerates undefined/empty config', () => {
    expect(stackConfigToApiShape(undefined)).toEqual({
      environmentVariables: {},
      portMappings: {},
      volumeMounts: {},
      dependsOn: [],
    })
  })
})
