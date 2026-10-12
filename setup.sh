#!/bin/bash

# Receipt Ledger - Setup Script
# This script helps automate the initial setup process

echo "🚀 Receipt Ledger Setup"
echo "===================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION detected. Please upgrade to Node.js 18+"
    exit 1
fi
echo "✅ Node.js $(node -v) detected"

# Check pnpm (preferred) or npm
if command -v pnpm &> /dev/null; then
    PACKAGE_MANAGER="pnpm"
    echo "✅ pnpm detected"
elif command -v npm &> /dev/null; then
    PACKAGE_MANAGER="npm"
    echo "✅ npm detected (consider installing pnpm for better performance)"
else
    echo "❌ No package manager found. Please install npm or pnpm"
    exit 1
fi

# Check wrangler
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  Wrangler not found. Installing globally..."
    npm install -g wrangler
fi
echo "✅ Wrangler CLI ready"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
$PACKAGE_MANAGER install

# Copy environment template if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "🔧 Setting up environment configuration..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo "⚠️  Please edit .env with your actual credentials"
else
    echo "⚠️  .env file already exists, skipping..."
fi

# Display next steps
echo ""
echo "🎉 Basic setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Login to Cloudflare: wrangler auth login"
echo "2. Create D1 database: wrangler d1 create accounting-db"
echo "3. Create R2 buckets:"
echo "   - wrangler r2 bucket create accounting-receipts"
echo "   - wrangler r2 bucket create accounting-receipts-preview"
echo "4. Update wrangler.toml with your database ID"
echo "5. Edit .env with your Azure OpenAI credentials"
echo "6. Run database migrations: $PACKAGE_MANAGER run db:migrate"
echo "7. Start development: $PACKAGE_MANAGER run dev"
echo ""
echo "📖 For detailed instructions, see SETUP.md"
echo ""
echo "🚀 Ready to revolutionize your accounting workflow!"