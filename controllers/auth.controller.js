import { supabase } from '../config/supabase.js';

const REGISTRATION_SECRET_KEY = process.env.REGISTRATION_SECRET_KEY;

export const signUp = async (req, res) => {
  try {
    const { email, password, name, role, phone, registrationKey } = req.body;

    // Enhanced validation
    if (!email || !password || !name || !role || !registrationKey) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: ['email', 'password', 'name', 'role', 'registrationKey']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate registration key
    if (registrationKey !== REGISTRATION_SECRET_KEY) {
      console.error('Invalid registration key attempt:', { email, registrationKey });
      return res.status(403).json({ 
        message: 'Invalid registration key. You are not authorized to register.' 
      });
    }

    // Check if user already exists in admin_staff
    const { data: existingStaff, error: staffCheckError } = await supabase
      .from('admin_staff')
      .select('id')
      .eq('email', email)
      .single();

    if (staffCheckError && staffCheckError.code !== 'PGRST116') {
      console.error('Staff check error:', staffCheckError);
      throw staffCheckError;
    }

    if (existingStaff) {
      return res.status(400).json({
        message: 'An account with this email already exists'
      });
    }

    // Create user in Supabase auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          phone
        },
        emailRedirectTo: `${process.env.FRONTEND_URL}/dashboard`
      }
    });

    if (error) {
      console.error('Supabase signup error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('User creation failed');
    }

    // Create admin_staff record
    const { error: profileError } = await supabase
      .from('admin_staff')
      .insert([
        {
          user_id: data.user.id,
          name,
          role,
          email: email.toLowerCase(),
          phone: phone || null,
        }
      ]);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Attempt to clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(data.user.id);
      throw profileError;
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

    // Return success response
    res.status(200).json({ 
      user: {
        id: data.user.id,
        email: data.user.email,
        name,
        role
      },
      message: data.session 
        ? 'Registration successful' 
        : 'Please check your email to confirm your registration'
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle specific error cases
    if (error.message?.includes('duplicate key')) {
      return res.status(400).json({ 
        message: 'An account with this email already exists'
      });
    }

    res.status(400).json({ 
      message: error.message || 'An error occurred during signup'
    });
  }
};

export const signIn = async (req, res) => {
  try {
    console.log('Sign in attempt for:', req.body.email);
    const { email, password } = req.body;

    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Supabase response:', { session: !!session, error });

    if (error) {
      console.error('Supabase signin error:', error);
      return res.status(401).json({ message: error.message });
    }

    if (!session) {
      console.error('No session returned from Supabase');
      return res.status(401).json({ message: 'Authentication failed' });
    }

    // Get additional user data from admin_staff table
    const { data: adminData, error: adminError } = await supabase
      .from('admin_staff')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (adminError) {
      console.error('Error fetching admin data:', adminError);
      return res.status(500).json({ message: 'Error fetching user data' });
    }

    // Combine Supabase user data with admin_staff data
    const userData = {
      id: session.user.id,
      email: session.user.email,
      name: adminData.name,
      role: adminData.role,
      phone: adminData.phone
    };

    // Set session cookie with the access token
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    };
    
    console.log('Setting cookie with options:', cookieOptions);
    res.cookie('session', session.access_token, cookieOptions);

    const responseData = { 
      session: {
        user: userData,
        access_token: session.access_token
      }
    };
    console.log('Sending response:', { hasUser: !!responseData.session.user });
    
    return res.json(responseData);
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
    console.log('Get session request, cookies:', req.cookies);
    const sessionToken = req.cookies.session;

    if (!sessionToken) {
      console.log('No session token found in cookies');
      return res.status(401).json({ message: 'No session found' });
    }

    // Verify session with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);
    console.log('Supabase getUser response:', { hasUser: !!user, error });

    if (error || !user) {
      console.log('Invalid session, clearing cookie');
      res.clearCookie('session');
      return res.status(401).json({ message: 'Invalid session' });
    }

    // Get additional user data from admin_staff table
    const { data: adminData, error: adminError } = await supabase
      .from('admin_staff')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (adminError) {
      console.error('Error fetching admin data:', adminError);
      return res.status(500).json({ message: 'Error fetching user data' });
    }

    // Combine Supabase user data with admin_staff data
    const userData = {
      id: user.id,
      email: user.email,
      name: adminData.name,
      role: adminData.role,
      phone: adminData.phone
    };

    return res.json({ 
      session: {
        user: userData,
        access_token: sessionToken
      }
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const inviteUser = async (req, res) => {
  try {
    const { email } = req.body;
    
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/dashboard`,
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
      redirectTo: `${process.env.FRONTEND_URL}/dashboard`
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
        emailRedirectTo: `${process.env.FRONTEND_URL}/dashboard`,
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