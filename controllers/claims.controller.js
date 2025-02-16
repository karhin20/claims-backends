import { supabase } from '../config/supabase.js';
import otpGenerator from 'otp-generator';

// Add input validation
const validateClaimInput = (data) => {
  const required = [
    'claimant_name',
    'claimant_id',
    'email',
    'phone',
    'address',
    'incident_date',
    'incident_location',
    'claim_type',
    'claim_amount',
    'description'
  ];

  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  if (isNaN(data.claim_amount) || data.claim_amount <= 0) {
    throw new Error('Claim amount must be a positive number');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new Error('Invalid email format');
  }

  // Validate phone number format
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  if (!phoneRegex.test(data.phone)) {
    throw new Error('Invalid phone number format');
  }

  // Validate date
  const incident_date = new Date(data.incident_date);
  if (isNaN(incident_date.getTime()) || incident_date > new Date()) {
    throw new Error('Invalid incident date or date is in the future');
  }
};

// Add admin check middleware
export const checkAdmin = async (req, res, next) => {
  try {
    const { user, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    
    const { data: adminData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('email', user.email)
      .single();
    
    if (!adminData?.is_admin) {
      return res.status(403).json({
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(401).json({
      message: 'Authentication required'
    });
  }
};

// Update routes to use admin check
export const createClaim = async (req, res) => {
  try {
    validateClaimInput(req.body);
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Insert claim into database
    const { data, error } = await supabase
      .from('claims')
      .insert([{
        ...req.body,
        status: 'pending',
        user_id: user.id,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Handle file uploads if any
    if (req.body.supporting_documents?.length > 0) {
      const filePromises = req.body.supporting_documents.map(async (file) => {
        const { error: uploadError } = await supabase.storage
          .from('claim-documents')
          .upload(`${data.id}/${file.name}`, file);
          
        if (uploadError) {
          console.error('File upload error:', uploadError);
          throw uploadError;
        }
      });

      await Promise.all(filePromises);
    }

    res.status(201).json({
      message: 'Claim submitted successfully',
      claim: data
    });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(400).json({
      message: error.message || 'Failed to submit claim'
    });
  }
};

export const getClaims = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json({
      claims: data
    });
  } catch (error) {
    console.error('Get claims error:', error);
    res.status(400).json({
      message: error.message || 'Failed to fetch claims'
    });
  }
};

export const getClaimById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        message: 'Claim not found'
      });
    }

    res.json({
      claim: data
    });
  } catch (error) {
    console.error('Get claim error:', error);
    res.status(400).json({
      message: error.message || 'Failed to fetch claim'
    });
  }
};

export const updateClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('claims')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Claim updated successfully',
      claim: data
    });
  } catch (error) {
    console.error('Update claim error:', error);
    res.status(400).json({
      message: error.message || 'Failed to update claim'
    });
  }
};

// Replace the simple generateOTP function with this more secure version
const generateOTP = () => {
  return otpGenerator.generate(6, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false
  });
};

// Store OTP with expiration (we'll add this to the claims table)
const storeOTP = async (claimId, otp) => {
  try {
    const { error } = await supabase
      .from('claims')
      .update({
        approval_otp: otp,
        otp_expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days expiry
      })
      .eq('id', claimId);

    if (error) throw error;
  } catch (error) {
    console.error('Error storing OTP:', error);
    throw error;
  }
};

export const generateApprovalOTP = async (req, res) => {
  try {
    const { claimId } = req.params;
    
    // Get claim details
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (claimError) throw claimError;

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP in database
    await storeOTP(claimId, otp);

    // Prepare SMS message with updated validity period
    const message = `Claim Approval Request\nClaimant: ${claim.claimant_name}\nAmount: ₵${claim.claim_amount}\nOTP: ${otp}\nValid for 5 days`;

    // TODO: Integrate with SMS service
    // For now, just log the message
    console.log('SMS Message to be sent:', message);

    res.json({
      message: 'OTP generated successfully',
      // In production, don't send OTP in response
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    console.error('Generate OTP error:', error);
    res.status(400).json({
      message: error.message || 'Failed to generate OTP'
    });
  }
};

export const verifyApprovalOTP = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { otp } = req.body;

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (claimError) throw claimError;

    // Check if OTP matches and hasn't expired
    if (!claim.approval_otp || claim.approval_otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (new Date(claim.otp_expires_at) < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Update claim status and clear OTP
    const { error: updateError } = await supabase
      .from('claims')
      .update({
        status: 'approved',
        approval_otp: null,
        otp_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', claimId);

    if (updateError) throw updateError;

    res.json({
      message: 'Claim approved successfully'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(400).json({
      message: error.message || 'Failed to verify OTP'
    });
  }
};

// Gets statistics for all claims by the current user
export const getStats = async (req, res) => {
  try {
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get claims stats
    const { data, error } = await supabase
      .from('claims')
      .select('id, status')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching claims stats:', error);
      return res.status(500).json({ message: 'Failed to fetch claims stats' });
    }

    // Calculate stats
    const stats = {
      total: data.length,
      pending: data.filter(claim => claim.status === 'pending').length,
      approved: data.filter(claim => claim.status === 'approved').length,
      rejected: data.filter(claim => claim.status === 'rejected').length
    };

    return res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ message: 'Failed to fetch claims stats' });
  }
};

// Gets the 5 most recent claims for the current user
export const getRecentActivity = async (req, res) => {
  try {
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get recent claims with RLS policy
    const { data, error } = await supabase
      .from('claims')
      .select(`
        id,
        claimant_name,
        claim_type,
        claim_amount,
        status,
        submitted_at
      `)
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching recent claims:', error);
      return res.status(500).json({ message: 'Failed to fetch recent claims' });
    }

    return res.json(data || []);
  } catch (error) {
    console.error('Recent activity error:', error);
    return res.status(500).json({ message: 'Failed to fetch recent claims' });
  }
}; 