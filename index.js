import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js'; 
import claimsRoutes from './routes/claims.routes.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Add allowed origins configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:5173',
  'https://claims-backends.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['set-cookie']
}));

app.use(cookieParser());
app.use(express.json());

// Add rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply to all routes
app.use(limiter);

// Specific limiter for OTP generation
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5 // limit each IP to 5 OTP requests per hour
});

app.use('/api/claims/:claimId/generate-otp', otpLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/claims', claimsRoutes);

// New route to display a message in the browser
app.get('/', (req, res) => {
    res.send('<p>generated successfully.</p>');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 