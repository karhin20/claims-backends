import { supabase } from '../config/supabase.js'; 

const REGISTRATION_SECRET_KEY = process.env.REGISTRATION_SECRET_KEY;

export const signUp = async (req, res) => {
  try {
    const { email, password, name, role, phone, registrationKey } = req.body;

    // Validate registration key
    if (!registrationKey || registrationKey !== REGISTRATION_SECRET_KEY) {
      return res.status(403).json({ 
        message: 'Invalid registration key. You are not authorized to register.' 
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          phone
        }
      }
    });

    if (error) throw error;

    // Insert additional user data into AdminStaff table
    const { error: profileError } = await supabase
      .from('AdminStaff')
      .insert([
        {
          user_id: data.user?.id,
          name,
          role,
          email,
          phone,
        }
      ]);

    if (profileError) throw profileError;

    // Set session cookie with proper security settings
    if (data.session) {
      res.cookie('session', data.session.access_token, {
        httpOnly: true,
        secure: true, // Always use secure in production
        sameSite: 'none', // Required for cross-origin requests
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
    }

    res.json({ user: data.user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Set session cookie with proper security settings
    res.cookie('session', data.session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({ user: data.user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const signOut = async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    res.clearCookie('session');
    res.json({ message: 'Signed out successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getSession = async (req, res) => {
  try {
    const token = req.cookies.session;
    
    // If no token is present, return null session without error
    if (!token) {
      return res.status(200).json({ session: null });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      // Clear invalid cookie
      res.clearCookie('session');
      return res.status(200).json({ session: null });
    }

    // Return valid session
    res.status(200).json({ 
      session: { 
        user,
        token 
      } 
    });
  } catch (error) {
    // Clear cookie on error
    res.clearCookie('session');
    res.status(200).json({ 
      session: null,
      error: error.message 
    });
  }
}; 