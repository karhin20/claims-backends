import { supabase } from '../config/supabase.js';
import otpGenerator from 'otp-generator';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
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
    // Handle file upload with multer middleware
    upload.array('files')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          message: err.message || 'File upload failed'
        });
      }
      
      // Debug logging
      console.log('Request cookies:', req.cookies);
      console.log('Request headers:', req.headers);
      console.log('Files received:', req.files?.length || 0);
      
      // Set credentials header
      res.header('Access-Control-Allow-Credentials', 'true');
  
      // User is already verified by middleware
      const user = req.user;
      
      // Get claim data from form or JSON
      let claimData;
      if (req.body.claimData) {
        // Parse the JSON string from FormData
        try {
          claimData = JSON.parse(req.body.claimData);
        } catch (e) {
          return res.status(400).json({
            message: 'Invalid claim data format'
          });
        }
      } else {
        claimData = req.body;
      }
      
      validateClaimInput(claimData);
  
      // Process uploaded files
      const fileInfos = req.files?.map(file => ({
        name: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      })) || [];
  
      // Insert claim into database
      const { data, error } = await supabase
        .from('claims')
        .insert([{
          ...claimData,
          status: 'pending',
          user_id: user.id,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          supporting_documents: fileInfos.length > 0 ? fileInfos : null
        }])
        .select()
        .single();
  
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
  
      res.status(201).json({
        message: 'Claim submitted successfully',
        claim: data
      });
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
    // Fetch all claims
    const { data, error } = await supabase
      .from('claims')
      .select('*');

    if (error) {
      console.error('Error fetching claims:', error);
      return res.status(500).json({ message: 'Failed to fetch claims' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Get claims error:', error);
    return res.status(500).json({ message: 'Failed to fetch claims' });
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
    
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Create the base OTP object
    const otpData = {
      claim_id: id,
      otp,
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days expiry
    };
    
    // Add created_by if we have a user in the request
    if (req.user && req.user.id) {
      otpData.created_by = req.user.id;
    }
    
    // Store OTP in database with expiration
    const { data, error } = await supabase
      .from('otps')
      .insert(otpData);
      
    if (error) {
      console.error('Error storing OTP:', error);
      
      // If the error is about the created_by column, try again without it
      if (error.message && error.message.includes('created_by')) {
        delete otpData.created_by;
        
        const { data: retryData, error: retryError } = await supabase
          .from('otps')
          .insert(otpData);
          
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
    
    // Get claim details for the notification
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', id)
      .single();
      
    if (claimError) throw claimError;
    
    // Update claim status to approved
    const { error: updateError } = await supabase
      .from('claims')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
      
    if (updateError) throw updateError;
    
    try {
      // Prepare notification message with OTP
      const message = `Your claim (Reference: ${claim.claimant_id}) for ₵${claim.claim_amount} has been approved. Your verification code is: ${otp}. Valid for 3 days.`;
      
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
            'Claim Approved - Verification Code',
            message
          )
        );
      }
      
      await Promise.all(notifications);
      
      res.status(200).json({ 
        message: 'Claim approved and verification code sent successfully',
        // For development only - remove in production
        otp: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    } catch (emailError) {
      console.error('Notification sending failed:', emailError);
      
      // Return success with OTP for development/testing
      res.status(200).json({ 
        message: 'Claim approved but notification failed. OTP generated successfully.',
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
        emailError: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }
  } catch (error) {
    console.error('Generate OTP error:', error);
    res.status(400).json({ message: error.message || 'Failed to generate OTP' });
  }
};

export const verifyApprovalOTP = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: 'OTP is required' });
    }

    // Get the latest valid OTP using claim UUID
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
    await supabase
      .from('otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    // Update claim status to confirmed
    const { data: claim, error: updateClaimError } = await supabase
      .from('claims')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateClaimError) throw updateClaimError;

    // Send confirmation notifications
    try {
      const confirmMessage = `Your claim (Reference: ${claim.claimant_id}) has been verified and confirmed for payment of ₵${claim.claim_amount}. Payment will be processed shortly.`;

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
            'Claim Confirmed for Payment',
            confirmMessage
          )
        );
      }

      await Promise.all(notifications);
    } catch (notificationError) {
      console.error('Failed to send notifications:', notificationError);
      // Continue with the response even if notifications fail
    }

    res.json({
      message: 'Claim verified and confirmed for payment'
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
    // Get all claims
    const { data, error } = await supabase
      .from('claims')
      .select('*');
      
    if (error) throw error;
    
    // Calculate stats
    const total = data.length;
    const pending = data.filter(claim => claim.status === 'pending').length;
    const reviewing = data.filter(claim => claim.status === 'reviewing').length;
    const approved = data.filter(claim => claim.status === 'approved').length;
    const confirmed = data.filter(claim => claim.status === 'confirmed').length;
    const rejected = data.filter(claim => claim.status === 'rejected').length;
    const paid = data.filter(claim => claim.status === 'paid').length;
    
    // Calculate total amount
    const totalAmount = data.reduce((sum, claim) => {
      return sum + (typeof claim.claim_amount === 'number' ? claim.claim_amount : 0);
    }, 0);
    
    res.json({
      total,
      pending,
      reviewing,
      approved,
      confirmed,
      rejected,
      paid,
      totalAmount
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(400).json({
      message: error.message || 'Failed to fetch stats'
    });
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