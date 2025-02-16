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

// Define allowed origins
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'https://claimsgh.netlify.app',
  'https://claims-backends.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Cookie',
    'X-Requested-With'
  ],
  exposedHeaders: ['Set-Cookie']
};

// Make sure CORS is the first middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Add logging middleware
app.use(requestLogger);

// Add this before the routes
app.options('*', cors(corsOptions)); // Enable preflight for all routes

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/claims', claimsRoutes);

// Health check route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Error handling should be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app; 