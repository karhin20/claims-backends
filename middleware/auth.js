import { supabase } from '../config/supabase.js';

export const auth = async (req, res, next) => {
  try {
    // Get session from cookie
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return res.status(401).json({
        message: 'Authentication required'
      });
    }

    // Add user to request object
    req.user = session.user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      message: 'Authentication required',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 