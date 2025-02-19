import cors from 'cors';
import cookieParser from 'cookie-parser';

// Add auth middleware to verify user session
app.use(async (req, res, next) => {
  try {
    // Get the session cookie
    const sessionCookie = req.cookies?.sb_session;
    
    if (!sessionCookie) {
      console.log('No session cookie found');
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify the session with Supabase
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('Session verification failed:', error);
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Attach the user to the request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Authentication required' });
  }
});

// Update CORS settings to ensure credentials are handled properly
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL || 'https://claims-backends.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['set-cookie'],
}));

// Ensure cookie middleware is configured properly
app.use(cookieParser());

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