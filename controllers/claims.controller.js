import { supabase } from '../config/supabase.js';
import otpGenerator from 'otp-generator';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

// Configure nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Function to send SMS via Arkesel
const sendSMS = async (phone, message) => {
  try {
    const apiKey = process.env.ARKESEL_API_KEY;
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: "ClaimsGH",
        message: message,
        recipients: [phone],
        // When sending to Nigerian numbers
        // use_case: 'transactional'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'SMS sending failed');
    }

    const data = await response.json();
    console.log('SMS sent successfully:', data);
    return data;
  } catch (error) {
    console.error('SMS sending error:', error);
    throw error;
  }
};

// Function to send email
const sendEmail = async (email, subject, message) => {
  try {
    await transporter.sendMail({
      from: '"ClaimsGH" <noreply@claimsgh.com>',
      to: email,
      subject,
      text: message,
      html: `<div style="font-family: Arial, sans-serif;">
        <h2>Claim Approval OTP</h2>
        <p>${message}</p>
      </div>`
    });
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

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
    // User is already verified by middleware
    const user = req.user;

    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .eq('user_id', user.id)  // Filter by user_id
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

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

export const generateApprovalOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;  // Get authenticated user
    
    console.log('Generate OTP request:', {
      claimId: id,
      userId: user.id,
      timestamp: new Date().toISOString()
    });
    
    // First verify the claim exists and is pending
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', id)
      // Optionally add user check
      // .eq('user_id', user.id)  // Uncomment if claims should be user-specific
      .single();

    if (claimError) {
      console.error('Database error fetching claim:', claimError);
      return res.status(400).json({
        message: 'Failed to fetch claim details',
        error: claimError.message,
        details: {
          claimId: id,
          userId: user.id,
          error: claimError
        }
      });
    }

    if (!claim) {
      console.error('No claim found with ID:', id);
      return res.status(404).json({
        message: 'Claim not found',
        details: `No claim found with ID: ${id}`
      });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({
        message: 'Only pending claims can be approved',
        details: `Current status: ${claim.status}`
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    console.log('Generated OTP:', otp, 'for claim:', id);
    
    // Store in otps table with logging
    const { data: otpData, error: otpError } = await supabase
      .from('otps')
      .insert({
        claim_id: id,
        otp: otp,
        expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (otpError) {
      console.error('Error storing OTP:', otpError);
      return res.status(500).json({
        message: 'Failed to generate verification code',
        error: otpError.message
      });
    }

    console.log('Successfully stored OTP in database:', {
      otp_id: otpData.id,
      claim_id: otpData.claim_id,
      expires_at: otpData.expires_at
    });

    // Prepare notification message
    const message = `ClaimsGH: Your verification code is ${otp}. Amount: GHS${claim.claim_amount}. Valid for 5 days. Do not share this code.`;

    try {
      // Send notifications
      const notifications = [];
      if (claim.phone) {
        const formattedPhone = claim.phone.startsWith('233') ? 
          claim.phone : 
          `233${claim.phone.replace(/^0+/, '')}`;
        notifications.push(sendSMS(formattedPhone, message));
      }
      if (claim.email) {
        notifications.push(
          sendEmail(
            claim.email,
            'Claim Verification Code',
            message
          )
        );
      }

      await Promise.all(notifications);
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      // Continue even if notifications fail
    }

    res.json({
      message: 'Verification code sent successfully',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      claim_id: id
    });
  } catch (error) {
    console.error('Generate OTP error:', error);
    res.status(500).json({
      message: 'Failed to send verification code',
      error: error.message
    });
  }
};

export const verifyApprovalOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    // Get the latest valid OTP from otps table
    const { data: otpRecord, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .eq('claim_id', id)
      .eq('otp', otp)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpRecord) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification code' 
      });
    }

    // Mark OTP as used
    const { error: updateOtpError } = await supabase
      .from('otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    if (updateOtpError) throw updateOtpError;

    // Update claim status
    const { data: claim, error: updateClaimError } = await supabase
      .from('claims')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateClaimError) throw updateClaimError;

    // Send confirmation notifications
    const confirmMessage = `Your claim (Reference: ${claim.claimant_id}) has been verified and approved for payment of ₵${claim.claim_amount}. Payment will be processed shortly.`;

    const notifications = [];
    if (claim.phone) {
      const formattedPhone = claim.phone.startsWith('233') ? 
        claim.phone : 
        `233${claim.phone.replace(/^0+/, '')}`;
      notifications.push(sendSMS(formattedPhone, confirmMessage));
    }
    if (claim.email) {
      notifications.push(
        sendEmail(
          claim.email,
          'Claim Approved for Payment',
          confirmMessage
        )
      );
    }

    await Promise.all(notifications);

    res.json({
      message: 'Claim verified and approved for payment'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(400).json({
      message: error.message || 'Failed to verify claim'
    });
  }
};

// Gets statistics for all claims by the current user
export const getStats = async (req, res) => {
  try {
    const user = req.user;

    const { data, error } = await supabase
      .from('claims')
      .select('id, status')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching claims stats:', error);
      return res.status(500).json({ message: 'Failed to fetch claims stats' });
    }

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

// Add a function to check OTP status (for debugging)
export const checkOTPStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: otps, error } = await supabase
      .from('otps')
      .select('*')
      .eq('claim_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      message: 'OTP status retrieved',
      otps: otps
    });
  } catch (error) {
    console.error('Check OTP status error:', error);
    res.status(500).json({
      message: 'Failed to check OTP status',
      error: error.message
    });
  }
}; 