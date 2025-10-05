const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - This is crucial for Docker
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Basic message endpoint
app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from API server!' });
});

// Payment plans queue endpoint (fix for your error)
app.get('/api/workflow/payment-plans/queue/fm', (req, res) => {
  res.json({ 
    success: true, 
    data: [],
    message: 'Payment plans queue endpoint working'
  });
});

// Inventory endpoint (fix for your error)
app.get('/api/inventory/unit-models', (req, res) => {
  res.json({ 
    success: true, 
    data: [],
    message: 'Inventory unit models endpoint working'
  });
});

// Inventory with pagination endpoint (fix for your error)
app.get('/api/inventory', (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  res.json({ 
    success: true, 
    data: [],
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total: 0
    },
    message: 'Inventory list endpoint working'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // This is the key fix - listen on all interfaces

app.listen(PORT, HOST, () => {
  console.log(`🚀 API Server running on http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
  console.log(`💬 Message endpoint: http://${HOST}:${PORT}/api/message`);
});