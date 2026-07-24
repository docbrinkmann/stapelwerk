# ADR-003: Pulumi for Infrastructure as Code

**Status:** Accepted  
**Date:** 2024-06-01  
**Decision Makers:** DevOps Team, Architecture Team

## Context

We need an Infrastructure as Code (IaC) solution that:
- Integrates well with our TypeScript codebase
- Supports multiple cloud providers
- Provides programmatic infrastructure provisioning via API
- Enables infrastructure templates for common patterns

### Options Considered

1. **Pulumi** - IaC with general-purpose programming languages
2. **Terraform** - HCL-based declarative IaC
3. **AWS CDK** - TypeScript IaC for AWS
4. **Crossplane** - Kubernetes-native IaC

## Decision

We chose **Pulumi with the Automation API** for infrastructure provisioning.

## Rationale

### Advantages

1. **TypeScript Native**
   - Same language as application code
   - Full IDE support and type checking
   - Reuse existing TypeScript skills

2. **Automation API**
   - Programmatic infrastructure provisioning
   - Embed infrastructure operations in application
   - No CLI dependency for deployments

3. **Multi-Cloud Support**
   - AWS, Azure, GCP, Kubernetes
   - Consistent API across providers
   - Easy to add new providers

4. **State Management**
   - Pulumi Cloud for state backend
   - Built-in secrets encryption
   - History and rollback support

### Trade-offs

1. **Pulumi Cloud Dependency** - State management requires Pulumi service
2. **Smaller Community** - Less community resources than Terraform
3. **Cost** - Pulumi Cloud has usage-based pricing

## Consequences

### Positive
- Type-safe infrastructure code catches errors early
- Can expose infrastructure operations as API endpoints
- Templates enable consistent infrastructure patterns

### Negative
- Team needs to learn Pulumi concepts
- State management adds complexity

## Implementation

### Automation API Client

```typescript
// src/lib/infrastructure/pulumi-automation-client.ts
export function createPulumiClient() {
  return {
    deployStack: async (config: StackConfig, program: PulumiFn) => {
      const stack = await LocalWorkspace.createOrSelectStack({
        stackName: config.stackName,
        projectName: config.projectName,
        program,
      });
      
      const result = await stack.up({ onOutput: console.log });
      return {
        success: true,
        outputs: result.outputs,
        summary: result.summary,
      };
    },
  };
}
```

### Infrastructure Templates

```typescript
// src/lib/infrastructure/pulumi-component-templates.ts
export function generateVPCProgram(config: VPCConfig): PulumiFn {
  return async () => {
    const vpc = new aws.ec2.Vpc('main-vpc', {
      cidrBlock: config.vpcCidr,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: { Name: 'main-vpc', ...config.tags },
    });
    
    // Create subnets, NAT gateway, etc.
    return {
      vpcId: vpc.id,
      publicSubnetIds: publicSubnets.map(s => s.id),
      privateSubnetIds: privateSubnets.map(s => s.id),
    };
  };
}
```

### Available Templates

| Template | Resources Created |
|----------|-------------------|
| `aws-vpc` | VPC, Subnets, NAT Gateway, Route Tables |
| `database` | RDS Instance, Security Groups, Parameter Group |
| `static-site` | S3 Bucket, CloudFront Distribution, OAI |
| `container-app` | ECS Cluster, Service, Task Definition, ALB |

## Testing Strategy

```typescript
// Tests use mocked Pulumi resources
describe('VPC Template', () => {
  it('should create VPC with correct CIDR', async () => {
    const program = generateVPCProgram({ vpcCidr: '10.0.0.0/16' });
    const result = await runPulumiProgram(program);
    expect(result.outputs.vpcId).toBeDefined();
  });
});
```

## Related Decisions
- ADR-002: GitOps with ArgoCD
- ADR-004: OpenTelemetry for Observability
