#!/bin/bash

echo "🔍 Running pre-deploy checks..."

npm run test -- --run
if [ $? -ne 0 ]; then echo "❌ Tests failed"; exit 1; fi
echo "✅ All tests passed"

npx tsc --noEmit
if [ $? -ne 0 ]; then echo "❌ TypeScript errors"; exit 1; fi
echo "✅ TypeScript OK"

npm run build
if [ $? -ne 0 ]; then echo "❌ Build failed"; exit 1; fi
echo "✅ Build successful"

npx vite-bundle-analyzer dist

echo "🚀 Ready to deploy!"
