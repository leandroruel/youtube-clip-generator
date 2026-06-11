#!/bin/bash
set -euo pipefail

echo "=== Initializing Garage cluster ==="

GARAGE_BUCKET="${GARAGE_BUCKET:-clipper}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-infra}"
CONTAINER="${COMPOSE_PROJECT}-garage-1"

garage() {
  docker exec "$CONTAINER" /garage "$@"
}

echo "Waiting for Garage..."
until curl -so /dev/null "http://localhost:3900" 2>&1; do
  sleep 1
done
echo "Garage is ready."

echo "Getting node ID..."
NODE_ID=$(garage node id 2>/dev/null | head -1)
if [ -z "$NODE_ID" ]; then
  NODE_ID=$(docker exec "$CONTAINER" cat /var/lib/garage/meta/node_key.pub 2>/dev/null || "")
fi
echo "Node ID: $NODE_ID"

# --- Layout (idempotent) ---
echo "Assigning node role in layout..."
garage layout assign -z dc1 -c 1G "$NODE_ID" 2>/dev/null || true

CURRENT_VERSION=$(garage layout show 2>/dev/null | grep "Current layout version" | awk '{print $NF}' || echo "0")
NEXT_VERSION=$((CURRENT_VERSION + 1))

echo "Applying layout (version $NEXT_VERSION)..."
garage layout apply --version "$NEXT_VERSION" 2>/dev/null || true

# --- Bucket (idempotent) ---
echo "Ensuring bucket '$GARAGE_BUCKET'..."
garage bucket delete "$GARAGE_BUCKET" --yes 2>/dev/null || true
garage bucket create "$GARAGE_BUCKET" 2>/dev/null || true

# --- API key (idempotent) ---
echo "Ensuring API key 'clipper-key'..."
for KEY_ID in $(garage key list 2>/dev/null | grep "clipper-key" | awk '{print $1}'); do
  garage key delete "$KEY_ID" --yes 2>/dev/null || true
done
KEY_OUTPUT=$(garage key create clipper-key 2>/dev/null || true)
echo "$KEY_OUTPUT"

ACCESS_KEY=$(echo "$KEY_OUTPUT" | grep "Key ID:" | awk '{print $NF}')
SECRET_KEY=$(echo "$KEY_OUTPUT" | grep "Secret key:" | awk '{print $NF}')

# --- Bucket permissions ---
echo "Allowing key to access bucket..."
garage bucket allow --read --write --owner "$GARAGE_BUCKET" --key clipper-key 2>/dev/null || true

echo ""
echo "=== Garage initialization complete ==="
echo ""
echo "Add these to your .env file:"
echo "  GARAGE_ACCESS_KEY=$ACCESS_KEY"
echo "  GARAGE_SECRET_KEY=$SECRET_KEY"
echo "  GARAGE_BUCKET=$GARAGE_BUCKET"
