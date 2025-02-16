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

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://claimsgh.netlify.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cookie', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
};

// Apply middlewares in the correct order
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Cookie settings middleware
app.use((req, res, next) => {
  res.cookie('cookieName', 'cookieValue', {
    sameSite: 'none',
    secure: true,
    httpOnly: true,
    domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined
  });
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