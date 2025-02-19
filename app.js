import cors from 'cors';

// Configure CORS with specific options
app.use(cors({
  origin: [
    'http://localhost:5173',  // Local development
    'https://your-frontend-domain.vercel.app', // Add your Vercel frontend domain
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['set-cookie'],
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

// Ensure cookies are being set correctly
app.use((req, res, next) => {
  res.cookie('session', req.cookies?.session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    domain: process.env.NODE_ENV === 'production' 
      ? '.your-domain.vercel.app'  // Update with your domain
      : 'localhost'
  });
  next();
}); 