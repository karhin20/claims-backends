import { supabase } from '../config/supabase.js';
import otpGenerator from 'otp-generator';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

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

// Add email and SMS configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Update routes to use admin check
export const createClaim = async (req, res) => {
  try {
    // User is already verified by middleware
    const user = req.user;
    
    validateClaimInput(req.body);

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

// Gets statistics for all claims by the current user
export const getStats = async (req, res) => {
  try {
    // User is already verified by middleware
    const user = req.user;

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
    // User is already verified by middleware
    const user = req.user;

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

// Update the generateOTP function
export const generateApprovalOTP = async (req, res) => {
  try {
    const { claimId } = req.params;
    if (!claimId) {
      return res.status(400).json({ message: 'Claim ID is required' });
    }

    // Get claim details
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: false,
      upperCase: false,
      specialChars: false
    });

    // Store OTP in database
    const { error: otpError } = await supabase
      .from('approval_otps')
      .insert([{
        claim_id: claimId,
        otp: otp,
        expires_at: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes expiry
      }]);

    if (otpError) {
      throw otpError;
    }

    // Send OTP via email
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: claim.email,
      subject: 'Claim Approval OTP',
      text: `Your OTP for claim approval is: ${otp}. This code will expire in 15 minutes.`
    });

    // Send OTP via SMS
    await twilioClient.messages.create({
      body: `Your ClaimsGH OTP is: ${otp}. Valid for 15 minutes.`,
      to: claim.phone,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Generate OTP error:', error);
    res.status(500).json({ message: error.message || 'Failed to generate OTP' });
  }
};

// Update the verifyOTP function
export const verifyApprovalOTP = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { otp } = req.body;

    if (!claimId || !otp) {
      return res.status(400).json({ message: 'Claim ID and OTP are required' });
    }

    // Verify OTP
    const { data: otpData, error: otpError } = await supabase
      .from('approval_otps')
      .select('*')
      .eq('claim_id', claimId)
      .eq('otp', otp)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (otpError || !otpData) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Update claim status
    const { data: claim, error: updateError } = await supabase
      .from('claims')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', claimId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Send approval confirmation
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: claim.email,
      subject: 'Claim Approved',
      text: `Your claim (ID: ${claim.id}) has been approved. Amount: ₵${claim.claim_amount}`
    });

    await twilioClient.messages.create({
      body: `Your claim (ID: ${claim.id}) has been approved. Amount: ₵${claim.claim_amount}`,
      to: claim.phone,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    res.json({ message: 'Claim approved successfully', claim });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: error.message || 'Failed to verify OTP' });
  }
}; 