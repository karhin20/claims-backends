import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Validation
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FRONTEND_URL'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

// Supabase client with retry logic
const createSupabaseClient = () => {
  const options = {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    },
    global: {
      fetch: fetch.bind(globalThis),
      headers: { 'x-application-name': 'claims-system' }
    }
  };

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    options
  );
};

export const supabase = createSupabaseClient();

// Helper functions
export const handleDatabaseError = (error) => {
  console.error('Database error:', error);
  
  // Map common database errors to user-friendly messages
  const errorMessages = {
    '23505': 'This record already exists.',
    '23503': 'Referenced record does not exist.',
    '23502': 'Required field is missing.'
  };

  return {
    message: errorMessages[error.code] || error.message || 'Database error occurred',
    code: error.code
  };
};

// Session management helpers
export const verifySession = async (token) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}; 