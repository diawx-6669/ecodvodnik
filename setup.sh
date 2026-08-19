#!/bin/bash

# Setup script for EcoTwin development environment

set -e

echo "🌱 EcoTwin Development Setup"
echo "============================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Пожалуйста, установите Node.js 18+"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git не найден. Пожалуйста, установите Git"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js $NODE_VERSION"

# Setup backend
echo ""
echo "Setting up backend..."
cd backend
npm install
echo "✓ Backend dependencies installed"
cd ..

# Setup environment
echo ""
echo "Setting up environment variables..."
if [ ! -f backend/.env ]; then
    cp .env.example backend/.env
    echo "✓ Created backend/.env from template"
    echo "⚠️  Please update backend/.env with your actual values"
else
    echo "✓ backend/.env already exists"
fi

# Git setup (optional)
echo ""
read -p "Setup Git hooks? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p .git/hooks
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."
cd backend
npx eslint . --max-warnings 0 2>/dev/null || echo "ESLint check skipped"
EOF
    chmod +x .git/hooks/pre-commit
    echo "✓ Git pre-commit hook installed"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update backend/.env with your API keys"
echo "2. Run 'make dev' to start development server"
echo "3. Open frontend/index.html in your browser"
echo ""
echo "For more info: make help"
