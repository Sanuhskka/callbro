#!/bin/bash

# Deployment script for HTTP API fix
# This adds REST API endpoints to the server

echo "🚀 Deploying HTTP API fix to server..."

# On local machine: commit and push
echo "📝 Step 1: Commit changes locally"
git add packages/server/src/index.ts packages/server/src/api/AuthRouter.ts packages/server/src/websocket/WebSocketServer.ts
git commit -m "Add HTTP REST API server for authentication endpoints"
git push origin main

echo "✅ Changes pushed to GitHub"
echo ""
echo "📋 Step 2: Run these commands on the server:"
echo ""
echo "cd /root/secure-p2p-messenger"
echo "git pull origin main"
echo "npm run build --workspace=@secure-p2p-messenger/server"
echo "pm2 restart secure-p2p-server"
echo "sleep 3"
echo "curl -X POST http://localhost:8081/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}'"
echo ""
echo "Expected: {\"error\":\"Invalid username or password\"}"
echo "If you see this, the HTTP API is working!"
