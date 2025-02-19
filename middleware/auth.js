export const auth = async (req, res, next) => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    console.log('Auth middleware - Session:', session); // Debug log
    
    if (error || !session) {
      return res.status(401).json({ 
        message: 'Authentication required',
        details: error?.message 
      });
    }

    req.user = session.user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      message: 'Authentication failed',
      details: error.message 
    });
  }
}; 