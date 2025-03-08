import { supabase } from '../config/supabase.js';

export const verifySession = async (req, res, next) => {
  try {
    // Get the session token from cookies
    const sessionToken = req.cookies.session;
    
    if (!sessionToken) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify the session token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
    
    if (error) {
      return res.status(401).json({ message: 'Invalid session' });
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Get additional user data from admin_staff table
    const { data: staffData, error: staffError } = await supabase
      .from('admin_staff')
      .select('name, role, phone')
      .eq('user_id', user.id)
      .single();

    if (staffError && staffError.code !== 'PGRST116') {
      // Only log critical errors
    }

    // Attach user to request object with combined data
    req.user = {
      ...user,
      name: staffData?.name || user.user_metadata?.name,
      role: staffData?.role || user.user_metadata?.role,
      phone: staffData?.phone || user.user_metadata?.phone
    };
    
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Middleware to check for admin role
export const requireAdmin = (req, res, next) => {
  const userRole = req.user.role || 
                  req.user.user_metadata?.role || 
                  req.user.app_metadata?.role;
  
  if (userRole !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  
  next();
}; 