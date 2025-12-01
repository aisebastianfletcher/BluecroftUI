#!/bin/sh
set -e

# Ensure you're on the branch Amplify builds (usually main)
git checkout main
git pull origin main

# Create services folder if missing and write the index file
mkdir -p src/BluecroftUI/services
cat > src/BluecroftUI/services/index.ts <<'EOF'
export * from './geminiService';
export { default } from './geminiService';
EOF

# Commit and push
git add src/BluecroftUI/services/index.ts
git commit -m "chore: add services index re-export to fix module resolution"
git push origin main

echo "Done. Now trigger an Amplify redeploy and choose 'Clear cache and redeploy'."
