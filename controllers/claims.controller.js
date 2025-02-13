import { supabase } from '../config/supabase.js';

// Add input validation
const validateClaimInput = (data) => {
  const required = [
    'claimantName',
    'claimantId',
    'email',
    'phone',
    'address',
    'incidentDate',
    'incidentLocation',
    'claimType',
    'claimAmount',
    'description'
  ];

  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  if (isNaN(data.claimAmount) || data.claimAmount <= 0) {
    throw new Error('Claim amount must be a positive number');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new Error('Invalid email format');
  }

  // Validate phone number format
  const phoneRegex = /^\+?[\d\s-]{10,}$/;  // Basic international phone format
  if (!phoneRegex.test(data.phone)) {
    throw new Error('Invalid phone number format');
  }

  // Validate date
  const incidentDate = new Date(data.incidentDate);
  if (isNaN(incidentDate.getTime()) || incidentDate > new Date()) {
    throw new Error('Invalid incident date or date is in the future');
  }
};

export const createClaim = async (req, res) => {
  try {
    validateClaimInput(req.body);
    
    // Convert claim amount to number
    const claimData = {
      ...req.body,
      claim_amount: Number(req.body.claimAmount)
    };

    const { data, error } = await supabase
      .from('claims')
      .insert([{
        claimant_name: claimData.claimantName,
        claimant_id: claimData.claimantId,
        email: claimData.email,
        phone: claimData.phone,
        address: claimData.address,
        incident_date: claimData.incidentDate,
        incident_location: claimData.incidentLocation,
        claim_type: claimData.claimType,
        claim_amount: claimData.claim_amount,
        description: claimData.description,
        status: 'pending',
        submitted_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

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

// Utility function to generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    const message = `Claim Approval Request\nClaimant: ${claim.claimant_name}\nAmount: $${claim.claim_amount}\nOTP: ${otp}\nValid for 5 days`;

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