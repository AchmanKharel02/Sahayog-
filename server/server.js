const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://admin.sahayog.com', 'exp://192.168.1.*:8081']
      : ['http://localhost:3000', 'http://10.0.2.2:8081', 'exp://192.168.1.*:8081'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://admin.sahayog.com']
    : ['http://localhost:3000', 'http://10.0.2.2:8081'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sahayog_db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('send_message', (data) => {
    const { receiverId, message } = data;
    socket.to(`user_${receiverId}`).emit('receive_message', message);
  });

  socket.on('typing_start', (data) => {
    const { receiverId } = data;
    socket.to(`user_${receiverId}`).emit('user_typing');
  });

  socket.on('typing_stop', (data) => {
    const { receiverId } = data;
    socket.to(`user_${receiverId}`).emit('user_stopped_typing');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/services', require('./src/routes/services'));
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/chat', require('./src/routes/chat'));
app.use('/api/reviews', require('./src/routes/reviews'));
app.use('/api/wallet', require('./src/routes/wallet'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/upload', require('./src/routes/upload'));
app.use('/api/admin', require('./src/routes/admin'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };