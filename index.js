import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js'; 
import claimsRoutes from './routes/claims.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Update CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:8080',
      'https://claimsgh.netlify.app',
      'https://claims-backends.vercel.app'
    ];
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
  exposedHeaders: ['set-cookie']
};

app.use(cors(corsOptions));

// Add preflight handling
app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/claims', claimsRoutes);

// New route to display a message in the browser
app.get('/', (req, res) => {
    res.send('<p>generated successfully.</p>');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app; 