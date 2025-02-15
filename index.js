import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js'; 
import claimsRoutes from './routes/claims.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { requestLogger } from './middlewares/logging.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Update CORS configuration
const corsOptions = {
  origin: [
    'https://claimsgh.netlify.app',
    'http://localhost:8080',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
  sameSite: 'none',
  secure: true
};

// Apply CORS middleware before routes
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

// Ensure cookies are being set properly
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Credentials', 'true');
  next();
});

// Add logging middleware
app.use(requestLogger);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/claims', claimsRoutes);

// Health check route
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Add this before the error handling middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.body,
    cookies: req.cookies,
    headers: req.headers
  });
  next();
});

// Error handling should be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app; 