# Apply to GKE (Guided)

This guide covers applying artifacts to Google Kubernetes Engine using kubeconfig or GitLab Agent (Workload Identity).

## Prerequisites
- kubectl, gcloud installed
- Workload Identity or service account with required roles
- Cert-Manager installed if using clusterIssuer from presets

## Steps
1) Authenticate
- gcloud auth login (local) or use Workload Identity in CI

2) Configure context
- Using kubeconfig (base64):
  export KUBECONFIG=$(mktemp)
  echo "$KUBECONFIG_B64" | base64 -d > "$KUBECONFIG"
- Using GitLab Agent:
  kubectl config use-context "${KUBE_CONTEXT}"

3) Apply manifests
kubectl apply -f out/gke/manifest.yaml
kubectl rollout status deploy -n <namespace>

4) Verify ingress and services
kubectl get ingress -A
kubectl get svc -A

5) Troubleshooting
- Ensure ingress class is "gce" and HTTP disabled if required
- Check LB provisioning events
