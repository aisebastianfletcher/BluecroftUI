#!/bin/sh
set -e

# Ensure you're on the branch Amplify builds (usually main)
git checkout main
git pull origin main

# Create the shim file
mkdir -p src/BluecroftUI/services
cat > src/BluecroftUI/services/geminiService.js <<'EOF'
export * from './geminiService';
export { default } from './geminiService';
EOF

# Commit & push
git add src/BluecroftUI/services/geminiService.js
git commit -m "chore: add JS shim to ensure geminiService resolves in CI"
git push origin main

echo "Pushed shim. Now go to Amplify Console -> Branch -> Redeploy this version (Clear cache & redeploy)."
