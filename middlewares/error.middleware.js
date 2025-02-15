export const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    code: err.code,
    path: req.path,
    method: req.method
  });

  // Handle Supabase-specific errors
  if (err.name === 'SupabaseError') {
    return res.status(400).json({
      message: err.message,
      code: err.code
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.errors
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message,
    code: err.code
  });
}; 