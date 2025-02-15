import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase signin error:', error);
      return res.status(401).json({ message: error.message });
    }

    if (!session) {
      return res.status(401).json({ message: 'Authentication failed' });
    }

    // Set session cookie
    res.cookie('session', session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ 
      session,
      user: session.user 
    });
  } catch (error) {
    console.error('Sign in controller error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    const sessionCookie = req.cookies.session;

    if (!sessionCookie) {
      return res.status(401).json({ message: 'No session found' });
    }

    // Verify session with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(
      sessionCookie.access_token
    );

    if (error || !user) {
      res.clearCookie('session');
      return res.status(401).json({ message: 'Invalid session' });
    }

    return res.json({ session: sessionCookie });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const inviteUser = async (req, res) => {
  try {
    const { email } = req.body;
    
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/signup?invited=true`,
      data: {
        invited: true
      }
    });

    if (error) throw error;

    res.json({
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(400).json({
      message: error.message || 'Failed to send invitation'
    });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (error) throw error;

    res.json({
      message: 'Password reset instructions sent'
    });
  } catch (error) {
    console.error('Password reset error:', error);
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

export const signInWithMagicLink = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required'
      });
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.FRONTEND_URL}/claims`,
        shouldCreateUser: true,
      }
    });

    if (error) throw error;

    res.json({
      message: 'Magic link sent to your email'
    });
  } catch (error) {
    console.error('Magic link error:', error);
    res.status(400).json({
      message: error.message || 'Failed to send magic link'
    });
  }
}; 