#!/bin/bash

# Push SAHAYOG to GitHub script
# Execute this script from the Sahayog- directory

echo "🚀 Setting up SAHAYOG repository for GitHub push..."

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    git init
    git branch -m main
fi

# Add remote origin
git remote add origin https://github.com/AchmanKharel02/Sahayog-.git

# Add all files
git add .

# Create initial commit
git commit -m "🎯 Complete SAHAYOG Marketplace Implementation

📋 PROJECT STRUCTURE:
├── app/          # React Native mobile app
├── server/       # Node.js backend API
├── admin/        # React admin panel
├── shared/       # Shared utilities
└── docs/         # Documentation

🔧 BACKEND (Node.js + Express):
✅ Complete REST API with authentication
✅ MongoDB database with 10+ models
✅ Real-time chat with Socket.io
✅ Wallet system with transactions
✅ File upload with Cloudinary
✅ Admin management APIs
✅ Security (JWT, rate limiting, validation)

📱 MOBILE APP (React Native + Expo):
✅ Complete authentication flow
✅ Service browsing and management
✅ Order placement and tracking
✅ Real-time messaging interface
✅ Wallet integration
✅ Multi-role navigation (user/seller)
✅ Modern UI with React Native Paper

🖥 ADMIN PANEL (React + Vite):
✅ Dashboard with analytics
✅ User and service management
✅ Order and withdrawal processing
✅ Revenue tracking
✅ Content moderation tools

🌐 KEY FEATURES:
✅ Nepali marketplace focused on local services
✅ Real-time communication
✅ Secure payment system
✅ Rating and review system
✅ Admin oversight
✅ Mobile-first design

🚀 Ready for local testing with Android Studio!

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push -u origin main

echo "✅ SAHAYOG marketplace successfully pushed to GitHub!"
echo "🔗 Repository: https://github.com/AchmanKharel02/Sahayog-"
echo ""
echo "📋 Next steps:"
echo "1. Clone repository: git clone https://github.com/AchmanKharel02/Sahayog-.git"
echo "2. cd Sahayog-"
echo "3. Follow setup instructions in README.md"
echo "4. Start backend: cd server && npm install && npm run dev"
echo "5. Start mobile: cd app && npm install && npx expo start"
echo "6. Start admin: cd admin && npm install && npm run dev"