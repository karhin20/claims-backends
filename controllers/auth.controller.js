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

    // Enhanced password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
      return res.status(400).json({
        message: 'Password must include uppercase, lowercase, numbers, and special characters'
      });
    }

    // Validate registration key
    if (registrationKey !== REGISTRATION_SECRET_KEY) {
      return res.status(403).json({ 
        message: 'Invalid registration key. You are not authorized to register.' 
      });
    }

    // Check if user already exists
    const { data: existingUser, error: existingUserError } = await supabase
      .from('admin_staff')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUserError && existingUserError.code !== 'PGRST116') {
      throw existingUserError;
    }

    if (existingUser) {
      return res.status(400).json({
        message: 'An account with this email already exists'
      });
    }

    // Step 1: Create user in Supabase auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
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

    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error('User creation failed');
    }

    // Verify user creation
    const maxRetries = 5;
    let retryCount = 0;
    let userExists = false;

    while (retryCount < maxRetries) {
      const { data: verifyUser } = await supabase.auth.admin.getUserById(authData.user.id);
      if (verifyUser) {
        userExists = true;
        break;
      }
      retryCount++;
      const delay = Math.pow(2, retryCount) * 100; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (!userExists) {
      throw new Error('User creation not confirmed after retries');
    }

    // Step 2: Create admin_staff record
    const { data: staffData, error: staffError } = await supabase
      .from('admin_staff')
      .insert([{
        user_id: authData.user.id,
        name,
        role,
        email: email.toLowerCase(),
        phone: phone || null,
      }])
      .select()
      .single();

    if (staffError) {
      // Cleanup: Delete auth user if staff creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Staff record creation failed: ${staffError.message}`);
    }

    // Set session cookie if session exists
    if (authData.session) {
      res.cookie('session', authData.session.access_token, {
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
        id: authData.user.id,
        email: authData.user.email,
        name,
        role
      },
      message: authData.session 
        ? 'Registration successful' 
        : 'Please check your email to confirm your registration'
    });

  } catch (error) {
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

export const getSession = async (req, res) => {
  try {
    // Get the session token from cookies
    const sessionToken = req.cookies.session;
    
    if (!sessionToken) {
      return res.json({ session: null });
    }

    // Verify the session token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(sessionToken);

    if (error || !user) {
      // Clear the invalid session cookie
      res.clearCookie('session', {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      });
      return res.json({ session: null });
    }

    // Get additional user data from admin_staff table
    const { data: staffData, error: staffError } = await supabase
      .from('admin_staff')
      .select('name, role, phone')
      .eq('user_id', user.id)
      .single();

    if (staffError) {
      console.error('Error fetching staff data:', staffError);
    }

    // Return the session with combined user data
    const session = {
      access_token: sessionToken,
      user: {
        ...user,
        name: staffData?.name || user.user_metadata?.name,
        role: staffData?.role || user.user_metadata?.role,
        phone: staffData?.phone || user.user_metadata?.phone
      }
    };

    return res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    return res.status(500).json({ 
      message: 'Failed to get session',
      error: error.message 
    });
  }
};

export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) throw error;

    if (!data.session) {
      throw new Error('No session returned from authentication');
    }

    // Set the session cookie
    res.cookie('session', data.session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    // Get additional user data from admin_staff table
    const { data: staffData, error: staffError } = await supabase
      .from('admin_staff')
      .select('name, role, phone')
      .eq('user_id', data.user.id)
      .single();

    if (staffError) {
      console.error('Error fetching staff data:', staffError);
    }

    // Return success with session and user data
    res.json({
      session: {
        ...data.session,
        user: {
          ...data.user,
          name: staffData?.name || data.user.user_metadata?.name,
          role: staffData?.role || data.user.user_metadata?.role,
          phone: staffData?.phone || data.user.user_metadata?.phone
        }
      }
    });

  } catch (error) {
    console.error('Sign in error:', error);
    res.status(401).json({
      message: error.message || 'Authentication failed'
    });
  }
};

export const signOut = async (req, res) => {
  try {
    // Clear the session cookie
    res.clearCookie('session');
    
    // If using JWT, you might want to add the token to a blacklist
    // or simply rely on the client removing the token
    
    return res.json({
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error('Sign out error:', error);
    return res.status(500).json({
      message: 'Failed to sign out'
    });
  }
};