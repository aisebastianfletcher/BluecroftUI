#!/bin/sh
set -e
git checkout main
git pull origin main
mkdir -p src/BluecroftUI/services
cat > src/BluecroftUI/services/geminiService.mjs <<'EOF'
export * from './geminiService';
export { default } from './geminiService';
EOF
git add src/BluecroftUI/services/geminiService.mjs
git commit -m "chore: add .mjs shim to ensure geminiService resolves in CI"
git push origin main
echo "Shim pushed. Now trigger Amplify: Redeploy this version (Clear cache & redeploy)."
