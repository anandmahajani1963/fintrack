#!/bin/bash
# fintrack — deploy updated images to k3s
# Usage: ./scripts/deploy.sh [api|frontend|all]

REGISTRY="192.168.1.169:5000"
TARGET=${1:-all}

if [[ "$TARGET" == "api" || "$TARGET" == "all" ]]; then
    echo "==> Building and pushing API..."
    cd ~/fintrack/backend
    docker compose build --no-cache
    docker tag backend-api:latest $REGISTRY/fintrack-api:latest
    docker push $REGISTRY/fintrack-api:latest
    kubectl rollout restart deployment/fintrack-api -n fintrack
    kubectl rollout status deployment/fintrack-api -n fintrack
fi

if [[ "$TARGET" == "frontend" || "$TARGET" == "all" ]]; then
    echo "==> Building and pushing frontend..."
    cd ~/fintrack/frontend
    docker compose build --no-cache
    docker tag frontend-frontend:latest $REGISTRY/fintrack-frontend:latest
    docker push $REGISTRY/fintrack-frontend:latest
    kubectl rollout restart deployment/fintrack-frontend -n fintrack
    kubectl rollout status deployment/fintrack-frontend -n fintrack
fi

echo "==> Done. Pod status:"
kubectl get pods -n fintrack
