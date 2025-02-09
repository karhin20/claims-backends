import { supabase } from '../config/supabase.js'; 

const REGISTRATION_SECRET_KEY = process.env.REGISTRATION_SECRET_KEY;

export const authController = {
  signUp: async (req, res) => {
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

      // Set session cookie
      if (data.session) {
        res.cookie('session', data.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      }

      res.json({ user: data.user });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  signIn: async (req, res) => {
    try {
      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Set session cookie
      res.cookie('session', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ user: data.user });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  signOut: async (req, res) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      res.clearCookie('session');
      res.json({ message: 'Signed out successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  getSession: async (req, res) => {
    try {
      const token = req.cookies.session;
      if (!token) {
        return res.json({ session: null });
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error) throw error;

      res.json({ session: { user: data.user } });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },
}; 