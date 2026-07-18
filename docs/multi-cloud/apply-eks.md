# Apply to EKS (Guided)

This guide walks you through applying artifacts to Amazon EKS using either a kubeconfig (base64) or GitLab Agent OIDC.

## Prerequisites
- kubectl installed
- Permissions to assume the EKS cluster role (IRSA/STS)
- Cert-Manager installed if using clusterIssuer from presets

## Steps
1) Authenticate via OIDC/STS
- Ensure your runner or workstation can assume the cluster role (IRSA for CI recommended)

2) Configure context
- Using kubeconfig (base64):
  export KUBECONFIG=$(mktemp)
  echo "$KUBECONFIG_B64" | base64 -d > "$KUBECONFIG"
- Using GitLab Agent:
  kubectl config use-context "${KUBE_CONTEXT}"

3) Apply manifests
kubectl apply -f out/eks/manifest.yaml
kubectl rollout status deploy -n <namespace>

4) Verify ingress and services
kubectl get ingress -A
kubectl get svc -A

5) Troubleshooting
- Check events: kubectl get events -A --sort-by=.lastTimestamp
- ALB issues: verify ingress annotations and target-type
