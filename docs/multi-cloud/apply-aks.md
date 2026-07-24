# Apply to AKS (Guided)

This guide covers applying artifacts to Azure Kubernetes Service using kubeconfig or GitLab Agent (Workload Identity).

## Prerequisites
- kubectl, az installed
- Federated Identity or service principal with required roles
- Cert-Manager installed if using clusterIssuer from presets

## Steps
1) Authenticate
- az login (local) or use Federated Identity in CI

2) Configure context
- Using kubeconfig (base64):
  export KUBECONFIG=$(mktemp)
  echo "$KUBECONFIG_B64" | base64 -d > "$KUBECONFIG"
- Using GitLab Agent:
  kubectl config use-context "${KUBE_CONTEXT}"

3) Apply manifests
kubectl apply -f out/aks/manifest.yaml
kubectl rollout status deploy -n <namespace>

4) Verify ingress and services
kubectl get ingress -A
kubectl get svc -A

5) Troubleshooting
- Ensure storage class is managed-csi and ingress annotations are set
- Check Azure LB probe path health
