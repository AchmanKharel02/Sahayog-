# SAHAYOG - Nepali Service Marketplace

A complete cross-platform service marketplace similar to Fiverr but focused on local Nepali services and tasks.

## 🏗️ Project Structure

```
Sahayog-/
├── app/                    # React Native mobile app
│   ├── src/
│   │   ├── components/     # Reusable UI and business components
│   │   ├── navigation/     # App navigation structure
│   │   ├── screens/        # All app screens
│   │   ├── store/          # Zustand state management
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API and external services
│   │   └── utils/          # Utility functions
│   ├── package.json
│   └── app.json
├── server/                 # Node.js backend API
│   ├── src/
│   │   ├── models/         # MongoDB models
│   │   ├── controllers/     # Route controllers
│   │   ├── routes/         # API routes
│   │   ├── middleware/      # Express middleware
│   │   ├── services/       # Business logic services
│   │   └── utils/          # Backend utilities
│   ├── uploads/            # File uploads directory
│   └── package.json
├── admin/                  # React admin panel
│   ├── src/
│   │   ├── components/     # Admin UI components
│   │   ├── pages/          # Admin dashboard pages
│   │   ├── store/          # Admin state management
│   │   └── services/       # Admin API services
│   └── package.json
├── shared/                 # Shared types and utilities
├── docs/                   # Documentation
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Android Studio (for mobile testing)
- Git

### Step 1: Backend Setup

```bash
cd server
npm install

# Create .env file from .env.example
cp .env.example .env
# Edit .env with your configuration

# Start MongoDB (local or Atlas)
# Seed database with initial categories
npm run seed

# Start backend server
npm run dev
```

Backend will run on `http://localhost:5000`

### Step 2: Mobile App Setup

```bash
cd app
npm install

# Start Expo development server
npx expo start
```

In Android Studio:
- Open Android Studio
- Create new emulator or use existing one
- Press "Run on Android device/emulator"
- Expo app will open automatically

### Step 3: Admin Panel Setup

```bash
cd admin
npm install

# Start development server
npm run dev
```

Admin panel will run on `http://localhost:3000`

## 📱 Mobile App Features

### Core Functionality
- ✅ User authentication (register, login, password reset)
- ✅ Service browsing and search
- ✅ Category-based navigation
- ✅ Service creation and management (sellers)
- ✅ Order placement and tracking
- ✅ Real-time chat with Socket.io
- ✅ Wallet system with transactions
- ✅ Review and rating system
- ✅ Notifications (in-app and push)
- ✅ Profile management
- ✅ Location-based services

### Technical Stack
- **Framework:** React Native with Expo
- **State Management:** Zustand
- **Navigation:** React Navigation v6
- **UI Components:** React Native Paper + Custom
- **Styling:** NativeWind (Tailwind CSS)
- **Real-time:** Socket.io
- **HTTP Client:** Axios

## 🔧 Backend API

### RESTful Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/verify-email/:token` - Email verification
- `POST /api/auth/forgot-password` - Password reset
- `POST /api/auth/reset-password/:token` - Password reset

#### Services
- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service details
- `POST /api/services` - Create service (seller)
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service
- `GET /api/services/featured` - Get featured services
- `GET /api/services/search` - Search services

#### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category details
- `POST /api/categories` - Create category (admin)

#### Orders
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status

#### Chat
- `GET /api/chat/conversations` - Get user conversations
- `GET /api/chat/:userId` - Get conversation
- `POST /api/chat/send` - Send message
- `POST /api/chat/:id/read` - Mark as read

#### Wallet
- `GET /api/wallet` - Get wallet details
- `POST /api/wallet/withdraw` - Request withdrawal
- `GET /api/wallet/transactions` - Get transaction history

### Database Models
- **User:** User accounts and profiles
- **Service:** Service listings
- **Category:** Service categories
- **Order:** Order management
- **Message:** Chat messages
- **Review:** Service reviews
- **Wallet:** User wallets
- **Transaction:** Financial transactions
- **WithdrawRequest:** Withdrawal requests
- **Notification:** System notifications

## 🖥️ Admin Panel

### Features
- ✅ Dashboard with statistics
- ✅ User management (ban/unban)
- ✅ Service management (approve/reject)
- ✅ Order management and support
- ✅ Withdrawal request processing
- ✅ Revenue analytics
- ✅ System notifications
- ✅ Content moderation

### Technical Stack
- **Framework:** React with Vite
- **UI Library:** ShadCN + Tailwind CSS
- **Charts:** Recharts
- **State Management:** Zustand
- **Routing:** React Router

## 🌐 Real-time Features

### Socket.io Events
```javascript
// Connection
io.on('connection', (socket) => {
  socket.join(`user_${userId}`);
});

// Chat Events
'send_message' -> Send message to receiver
'receive_message' -> Receiver gets message
'typing_start' -> User starts typing
'typing_stop' -> User stops typing

// Order Events
'order_created' -> New order notification
'order_status_updated' -> Order status change
'order_completed' -> Order completion

// Notification Events
'notification_push' -> Push notification
'user_online' -> User comes online
'user_offline' -> User goes offline
```

## 💳 Payment & Wallet System

### Features
- ✅ Secure wallet with balance management
- ✅ Automatic commission calculation (10% default)
- ✅ Transaction history and analytics
- ✅ Withdrawal requests with admin approval
- ✅ Support for Nepali payment methods (eSewa, Khalti)
- ✅ Refund system
- ✅ Multi-currency support (primary: NPR)

## 🔒 Security

### Implemented Measures
- ✅ JWT authentication with refresh tokens
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ Input validation and sanitization
- ✅ Rate limiting per endpoint
- ✅ CORS configuration
- ✅ File upload security
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Environment variable protection

## 📊 Analytics & Reporting

### Admin Dashboard Statistics
- User metrics (registration, active, sellers)
- Service statistics (creation, approval, featured)
- Order analytics (completion rates, revenue)
- Financial reporting (earnings, withdrawals, commissions)
- Support metrics (disputes, resolutions)
- Performance monitoring (API response times)

## 🧪 Testing

### Mobile App Testing
```bash
cd app
npm test
```

### Backend Testing
```bash
cd server
npm test
```

### Manual Testing Checklist
- [ ] User registration flow
- [ ] Email verification
- [ ] Service creation and management
- [ ] Order placement and tracking
- [ ] Payment processing
- [ ] Real-time messaging
- [ ] Admin panel functions
- [ ] File uploads
- [ ] Push notifications

## 🌍 Localization

### Supported Languages (Planned)
- 🇳🇵 Nepali (primary)
- 🇬🇧 English
- 🇮🇳 Hindi

### Nepali-Specific Features
- Local currency support (NPR)
- Nepali phone number validation
- Local payment gateway integration
- Region-specific categories
- Nepali address formats

## 🚀 Deployment

### Production Deployment

#### Backend
```bash
cd server
npm run build
pm2 start server.js
```

#### Mobile App
```bash
cd app
npx eas build --platform android
# Submit to Google Play Store
```

#### Admin Panel
```bash
cd admin
npm run build
# Deploy dist/ folder to web server
```

## 🔧 Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sahayog_db
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key
COMMISSION_RATE=0.10
MIN_WITHDRAWAL=500
```

### Mobile App (.env)
```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000
```

### Admin Panel (.env)
```env
VITE_API_URL=http://localhost:5000/api
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋 Support

For support, contact:
- Email: support@sahayog.com
- Phone: +977-98XXXXXXXX
- Address: Kathmandu, Nepal

## 🎯 Roadmap

### Phase 1: Core Platform (Current)
- ✅ User authentication
- ✅ Service marketplace
- ✅ Order management
- ✅ Payment system
- ✅ Real-time chat

### Phase 2: Enhanced Features
- 🔄 Mobile app deployment
- 🔄 Push notifications
- 🔄 Advanced search with filters
- 🔄 Service recommendations
- 🔄 Rating system with reviews

### Phase 3: Expansion
- 📋 Mobile wallet payments
- 📋 Service provider verification
- 📋 Dispute resolution system
- 📋 Analytics dashboard
- 📋 API for third-party integrations

---

**Built with ❤️ for the Nepali community**