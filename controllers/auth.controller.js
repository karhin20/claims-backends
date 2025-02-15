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

    // Check if user needs to confirm their email
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return res.status(400).json({
        message: 'Email confirmation required. Please check your email.'
      });
    }

    // Only proceed with AdminStaff creation if email is confirmed
    if (data.user && data.user.confirmed_at) {
      // Insert additional user data into AdminStaff table
      const { error: profileError } = await supabase
        .from('AdminStaff')
        .insert([
          {
            user_id: data.user.id,
            name,
            role,
            email,
            phone,
          }
        ]);

      if (profileError) throw profileError;
    }

    // Set session cookie if session exists
    if (data.session) {
      res.cookie('session', data.session.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });
    }

    // Return success with appropriate message
    res.status(200).json({ 
      user: data.user,
      message: 'Please check your email to confirm your registration.'
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ 
      message: error.message || 'An error occurred during signup'
    });
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

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required'
      });
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (error) throw error;

    res.json({
      message: 'Password reset instructions sent to your email'
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(400).json({
      message: error.message || 'Failed to send reset instructions'
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: 'Token and new password are required'
      });
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    res.json({
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({
      message: error.message || 'Failed to reset password'
    });
  }
}; 