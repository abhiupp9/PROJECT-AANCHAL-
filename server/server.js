const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS — allow GitHub Pages frontend + localhost dev
const allowedOrigins = [
  'https://abhiupp9.github.io',   // GitHub Pages
  'http://localhost:5173',          // Vite dev
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) {
      return callback(null, true);
    }
    return callback(null, true); // allow all for now (open API)
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory data store for emergency contacts
let emergencyContacts = [
  { id: '1', name: 'Emergency Services (National)', phone: '112', relationship: 'Official' },
  { id: '2', name: 'Emergency Contact 1 (Father)', phone: '+919876543210', relationship: 'Family' },
  { id: '3', name: 'Emergency Contact 2 (Sister)', phone: '+918765432109', relationship: 'Family' }
];

// In-memory log of triggered alerts
let distressAlerts = [];

// Mock Safe Corridors Data (centered around a mock city center: e.g., Connaught Place, New Delhi)
// Includes CCTV cameras, street lighting quality, and police booths.
const safeCorridors = {
  center: { lat: 28.6304, lng: 77.2177 },
  corridors: [
    {
      id: 'path-1',
      name: 'Outer Circle Corridor (High Security)',
      safetyScore: 95,
      polyline: [
        [28.6304, 77.2177],
        [28.6315, 77.2205],
        [28.6285, 77.2225],
        [28.6255, 77.2200],
        [28.6260, 77.2150],
        [28.6304, 77.2177]
      ],
      features: {
        cctvCount: 14,
        lightingLevel: 'Excellent',
        policeCheckpoints: 2
      }
    },
    {
      id: 'path-2',
      name: 'Janpath Avenue (Safe Passage)',
      safetyScore: 90,
      polyline: [
        [28.6304, 77.2177],
        [28.6225, 77.2185],
        [28.6150, 77.2190]
      ],
      features: {
        cctvCount: 8,
        lightingLevel: 'Excellent',
        policeCheckpoints: 1
      }
    },
    {
      id: 'path-3',
      name: 'Barakhamba Road (Commercial Corridor)',
      safetyScore: 85,
      polyline: [
        [28.6304, 77.2177],
        [28.6310, 77.2280],
        [28.6260, 77.2320]
      ],
      features: {
        cctvCount: 10,
        lightingLevel: 'Good',
        policeCheckpoints: 1
      }
    }
  ],
  securityElements: [
    { id: 'cctv-1', type: 'CCTV', name: 'Metro Gate 1 Camera', lat: 28.6308, lng: 77.2182, status: 'Active' },
    { id: 'cctv-2', type: 'CCTV', name: 'Radial Road 2 Camera', lat: 28.6295, lng: 77.2200, status: 'Active' },
    { id: 'cctv-3', type: 'CCTV', name: 'Janpath Junction Camera', lat: 28.6226, lng: 77.2186, status: 'Active' },
    { id: 'booth-1', type: 'Police Booth', name: 'CP Circle Police Outpost', lat: 28.6302, lng: 77.2165, status: 'Manned 24/7' },
    { id: 'booth-2', type: 'Police Booth', name: 'Janpath Crossing Booth', lat: 28.6185, lng: 77.2188, status: 'Manned 24/7' },
    { id: 'light-1', type: 'Smart Light', name: 'Outer Circle Pole 24', lat: 28.6312, lng: 77.2195, status: 'On - Bright' }
  ]
};

// User authentication storage (in-memory fallback if Supabase unavailable)
let registeredUsers = [
  { username: 'admin', phone: '9876543210', password: '1234' }
];

// User Registration Endpoint
app.post('/api/register', async (req, res) => {
  const { username, phone, password } = req.body;
  if (!username || !phone || !password) {
    return res.status(400).json({ error: 'All fields (Username, Phone Number, Password) are required' });
  }

  // Clean up input values
  const cleanUsername = username.trim();
  const cleanPhone = phone.trim().replace(/\s+/g, '');

  try {
    // 1. Check if user already exists in Supabase
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('username, phone')
      .or(`username.ilike.${cleanUsername},phone.eq.${cleanPhone}`);

    if (checkError) throw checkError;

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username or Phone Number is already registered' });
    }

    // 2. Insert user into Supabase
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ username: cleanUsername, phone: cleanPhone, password }])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`👤 [Supabase] NEW USER REGISTERED: ${newUser.username} (${newUser.phone})`);
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: { username: newUser.username, phone: newUser.phone }
    });

  } catch (dbError) {
    console.error('⚠️ Supabase register error, falling back to local memory:', dbError.message || dbError);

    // Fallback: Check local in-memory
    const exists = registeredUsers.some(
      u => u.username.toLowerCase() === cleanUsername.toLowerCase() || u.phone === cleanPhone
    );

    if (exists) {
      return res.status(400).json({ error: 'Username or Phone Number is already registered' });
    }

    const newUser = {
      username: cleanUsername,
      phone: cleanPhone,
      password: password
    };

    registeredUsers.push(newUser);
    console.log(`👤 [Local Memory] NEW USER REGISTERED: ${newUser.username} (${newUser.phone})`);
    
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: { username: newUser.username, phone: newUser.phone }
    });
  }
});

// User Login Endpoint (Supports Username OR Phone Login)
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body; // 'identifier' is username or phone
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter Username/Phone and Password' });
  }

  const cleanIdentifier = identifier.trim().replace(/\s+/g, '');

  try {
    // Try Supabase first
    const { data: user, error: loginError } = await supabase
      .from('users')
      .select('username, phone, password')
      .or(`username.ilike.${cleanIdentifier},phone.eq.${cleanIdentifier}`)
      .maybeSingle();

    if (loginError) throw loginError;

    if (user && user.password === password) {
      console.log(`🔓 [Supabase] USER LOGGED IN: ${user.username}`);
      return res.status(200).json({
        success: true,
        username: user.username,
        phone: user.phone
      });
    }

    if (user && user.password !== password) {
      return res.status(401).json({ error: 'Invalid Username/Phone number or Password' });
    }

    // User not found in Supabase - check local memory fallback
    const localUser = registeredUsers.find(u => 
      (u.username.toLowerCase() === cleanIdentifier.toLowerCase() || u.phone === cleanIdentifier) && 
      u.password === password
    );

    if (!localUser) {
      return res.status(401).json({ error: 'Invalid Username/Phone number or Password' });
    }

    console.log(`🔓 [Local Memory] USER LOGGED IN: ${localUser.username}`);
    return res.status(200).json({
      success: true,
      username: localUser.username,
      phone: localUser.phone
    });

  } catch (dbError) {
    console.error('⚠️ Supabase login error, falling back to local memory:', dbError.message || dbError);

    // Fallback: Check local memory
    const user = registeredUsers.find(u => 
      (u.username.toLowerCase() === cleanIdentifier.toLowerCase() || u.phone === cleanIdentifier) && 
      u.password === password
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid Username/Phone number or Password' });
    }

    console.log(`🔓 [Local Memory] USER LOGGED IN: ${user.username}`);
    return res.status(200).json({
      success: true,
      username: user.username,
      phone: user.phone
    });
  }
});

// ─── OTP Store (in-memory) ─────────────────────────────────────────────────
// Structure: { phone: { otp, expiresAt } }
const otpStore = {};

// Helper: generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 3a. Send OTP for Forgot Password
app.post('/api/forgot-password', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const cleanPhone = phone.trim().replace(/\s+/g, '');

  try {
    // 1. Find the registered user by phone in Supabase
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (userError) throw userError;

    let targetUsername = '';

    if (!user) {
      // Check if user is in local memory instead
      const localUser = registeredUsers.find(u => u.phone === cleanPhone);
      if (!localUser) {
        return res.status(404).json({ error: 'No account found with this phone number.' });
      }
      targetUsername = localUser.username;
    } else {
      targetUsername = user.username;
    }

    // 2. Generate OTP and store in Supabase
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;   // 10 minutes

    const { error: otpError } = await supabase
      .from('otp_store')
      .upsert({
        phone: cleanPhone,
        otp,
        expires_at: expiresAt,
        verified: false,
        username: targetUsername
      });

    if (otpError) throw otpError;

    // Simulate SMS dispatch
    console.log('\n══════════════════════════════════════════════════');
    console.log(`📲 [Supabase] AANCHAL OTP DISPATCH — Forgot Password`);
    console.log(`👤 User: ${targetUsername}`);
    console.log(`📞 Phone: ${cleanPhone}`);
    console.log(`🔑 OTP (simulated SMS): ${otp}`);
    console.log(`⏰ Valid for: 10 minutes`);
    console.log(`📩 SMS Content: "Your AANCHAL password reset OTP is: ${otp}. Valid for 10 minutes. Do not share this with anyone."`);
    console.log('══════════════════════════════════════════════════\n');

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to +91-${cleanPhone.slice(-10)}.`,
      demoOtp: otp
    });

  } catch (dbError) {
    console.error('⚠️ Supabase forgot-password error, falling back to local memory:', dbError.message || dbError);

    // Fallback: Check local memory
    const user = registeredUsers.find(u => u.phone === cleanPhone);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this phone number.' });
    }

    const otp = generateOTP();
    otpStore[cleanPhone] = {
      otp,
      username: user.username,
      expiresAt: Date.now() + 10 * 60 * 1000   // 10 minutes
    };

    // Simulate SMS dispatch
    console.log('\n══════════════════════════════════════════════════');
    console.log(`📲 [Local Memory] AANCHAL OTP DISPATCH — Forgot Password`);
    console.log(`👤 User: ${user.username}`);
    console.log(`📞 Phone: ${cleanPhone}`);
    console.log(`🔑 OTP (simulated SMS): ${otp}`);
    console.log(`⏰ Valid for: 10 minutes`);
    console.log(`📩 SMS Content: "Your AANCHAL password reset OTP is: ${otp}. Valid for 10 minutes. Do not share this with anyone."`);
    console.log('══════════════════════════════════════════════════\n');

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to +91-${cleanPhone.slice(-10)}.`,
      demoOtp: otp
    });
  }
});

// Helper for local OTP verify
function handleLocalVerifyOtp(cleanPhone, otp, res) {
  const record = otpStore[cleanPhone];
  if (!record) {
    return res.status(400).json({ error: 'No OTP request found. Please request a new OTP.' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[cleanPhone];
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Incorrect OTP. Please check and try again.' });
  }

  otpStore[cleanPhone].verified = true;
  console.log(`✅ [Local Memory] OTP VERIFIED for ${record.username} (${cleanPhone})`);
  return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
}

// 3b. Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required.' });
  }

  const cleanPhone = phone.trim().replace(/\s+/g, '');

  try {
    // 1. Get OTP from Supabase
    const { data: record, error: otpError } = await supabase
      .from('otp_store')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (otpError) throw otpError;

    if (!record) {
      // Fallback: Check local in-memory OTP
      return handleLocalVerifyOtp(cleanPhone, otp, res);
    }

    if (Date.now() > record.expires_at) {
      await supabase.from('otp_store').delete().eq('phone', cleanPhone);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect OTP. Please check and try again.' });
    }

    // 2. Mark as verified
    const { error: updateError } = await supabase
      .from('otp_store')
      .update({ verified: true })
      .eq('phone', cleanPhone);

    if (updateError) throw updateError;

    console.log(`✅ [Supabase] OTP VERIFIED for ${record.username} (${cleanPhone})`);
    return res.status(200).json({ success: true, message: 'OTP verified successfully.' });

  } catch (dbError) {
    console.error('⚠️ Supabase verify-otp error, falling back to local memory:', dbError.message || dbError);
    return handleLocalVerifyOtp(cleanPhone, otp, res);
  }
});

// Helper for local reset
function handleLocalResetPassword(cleanPhone, otp, newPassword, res) {
  const record = otpStore[cleanPhone];
  if (!record || !record.verified || record.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid or unverified OTP. Please restart the reset process.' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[cleanPhone];
    return res.status(400).json({ error: 'Session expired. Please request a new OTP.' });
  }

  const userIndex = registeredUsers.findIndex(u => u.phone === cleanPhone);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  registeredUsers[userIndex].password = newPassword;
  delete otpStore[cleanPhone];

  console.log(`🔐 [Local Memory] PASSWORD RESET SUCCESSFUL for ${registeredUsers[userIndex].username} (${cleanPhone})`);
  return res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' });
}

// 3c. Reset Password (after OTP verified)
app.post('/api/reset-password', async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  if (!phone || !otp || !newPassword) {
    return res.status(400).json({ error: 'Phone, OTP, and new password are required.' });
  }

  const cleanPhone = phone.trim().replace(/\s+/g, '');

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
  }

  try {
    // 1. Fetch OTP record from Supabase
    const { data: record, error: otpError } = await supabase
      .from('otp_store')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (otpError) throw otpError;

    if (!record) {
      // Fallback: Check local memory
      return handleLocalResetPassword(cleanPhone, otp, newPassword, res);
    }

    if (!record.verified || record.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid or unverified OTP. Please restart the reset process.' });
    }

    if (Date.now() > record.expires_at) {
      await supabase.from('otp_store').delete().eq('phone', cleanPhone);
      return res.status(400).json({ error: 'Session expired. Please request a new OTP.' });
    }

    // 2. Update user's password in Supabase
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('phone', cleanPhone)
      .select();

    if (updateError) throw updateError;

    // Check if user was actually updated in Supabase (might be in local memory user store)
    if (!updatedUser || updatedUser.length === 0) {
      // User is likely local-only, try updating locally
      const userIndex = registeredUsers.findIndex(u => u.phone === cleanPhone);
      if (userIndex !== -1) {
        registeredUsers[userIndex].password = newPassword;
      } else {
        return res.status(404).json({ error: 'User not found.' });
      }
    }

    // 3. Delete OTP record from Supabase
    await supabase.from('otp_store').delete().eq('phone', cleanPhone);

    console.log(`🔐 [Supabase] PASSWORD RESET SUCCESSFUL for phone (${cleanPhone})`);
    return res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' });

  } catch (dbError) {
    console.error('⚠️ Supabase reset-password error, falling back to local memory:', dbError.message || dbError);
    return handleLocalResetPassword(cleanPhone, otp, newPassword, res);
  }
});

// 1. Health check
app.get('/api/health-check', (req, res) => {
  res.json({ status: 'AANCHAL Backend is running', timestamp: new Date() });
});


// 2. Fetch safe corridors map details
app.get('/api/safe-corridors', (req, res) => {
  res.json(safeCorridors);
});

// 3. Contacts API
app.get('/api/contacts', async (req, res) => {
  try {
    const { data: contactsList, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return res.json(contactsList);
  } catch (dbError) {
    console.error('⚠️ Supabase get contacts error, falling back to local memory:', dbError.message || dbError);
    return res.json(emergencyContacts);
  }
});

app.post('/api/contacts', async (req, res) => {
  const { name, phone, relationship } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required' });
  }

  const payload = {
    name,
    phone,
    relationship: relationship || 'Friend'
  };

  try {
    const { data: newContact, error } = await supabase
      .from('emergency_contacts')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    console.log(`➕ [Supabase] CONTACT ADDED: ${newContact.name}`);
    return res.status(201).json(newContact);
  } catch (dbError) {
    console.error('⚠️ Supabase add contact error, falling back to local memory:', dbError.message || dbError);

    const newContact = {
      id: Date.now().toString(),
      name,
      phone,
      relationship: relationship || 'Friend'
    };
    emergencyContacts.push(newContact);
    console.log(`➕ [Local Memory] CONTACT ADDED: ${newContact.name}`);
    return res.status(201).json(newContact);
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Filter local memory anyway to stay in sync
    emergencyContacts = emergencyContacts.filter(c => c.id !== id);
    
    console.log(`🗑️ [Supabase] CONTACT REMOVED: ID ${id}`);
    return res.json({ message: 'Contact removed successfully (Supabase)' });
  } catch (dbError) {
    console.error('⚠️ Supabase delete contact error, falling back to local memory:', dbError.message || dbError);

    emergencyContacts = emergencyContacts.filter(c => c.id !== id);
    console.log(`🗑️ [Local Memory] CONTACT REMOVED: ID ${id}`);
    return res.json({ message: 'Contact removed successfully (In-Memory Fallback)' });
  }
});

// 4. Alert Trigger API
// Simulates sending SMS and notifying emergency services
app.post('/api/alert', async (req, res) => {
  const { lat, lng, type, timestamp } = req.body;
  
  const alertRecord = {
    id: `alert-${Date.now()}`,
    lat: lat || 28.6304,
    lng: lng || 77.2177,
    type: type || 'VOICE_TRIGGER',
    timestamp: timestamp || new Date().toISOString()
  };

  // Try saving to Supabase
  try {
    const { error } = await supabase
      .from('distress_alerts')
      .insert([alertRecord]);

    if (error) throw error;
    console.log(`🚨 [Supabase] DISTRESS ALERT RECORDED`);
  } catch (dbError) {
    console.error('⚠️ Supabase alert record error, falling back to local memory:', dbError.message || dbError);
    distressAlerts.push(alertRecord);
  }

  // Fetch current contacts list (either from Supabase or local memory) to notify
  let contactsToNotify = [...emergencyContacts];
  try {
    const { data: contactsList, error } = await supabase
      .from('emergency_contacts')
      .select('*');
    
    if (!error && contactsList && contactsList.length > 0) {
      contactsToNotify = contactsList;
    }
  } catch (contactsFetchError) {
    // Ignored: fallback list is already populated
  }

  console.log('\n======================================================');
  console.log(`🚨 DANGER SIGNAL RECEIVED AT [${alertRecord.timestamp}]`);
  console.log(`📡 SOURCE: ${alertRecord.type}`);
  console.log(`📍 LOCATION: Latitude ${alertRecord.lat}, Longitude ${alertRecord.lng}`);
  console.log('------------------------------------------------------');
  console.log('✉️  SENDING SIMULATED SOS SMS TO PRE-SAVED CONTACTS:');
  
  contactsToNotify.forEach(contact => {
    console.log(`   👉 To: ${contact.name} (${contact.phone})`);
    console.log(`      Content: "🚨 EMERGENCY! AANCHAL safety shield triggered. I need help. My current location: https://maps.google.com/?q=${alertRecord.lat},${alertRecord.lng}"`);
  });
  
  console.log('📞 DISPATCHING ALERT TO POLICE CONTROL ROOM (112)... DONE.');
  console.log('======================================================\n');

  res.status(200).json({
    success: true,
    message: 'Distress alerts dispatched successfully',
    alertDetails: alertRecord,
    notifiedContacts: contactsToNotify
  });
});

// 5. Muffled Screaming Real-Time Audio Streaming API
app.post('/api/upload-recording', async (req, res) => {
  const { lat, lng, username, audioData, timestamp } = req.body;

  const currentTimestamp = timestamp || new Date().toISOString();
  const locationLat = lat || 28.6304;
  const locationLng = lng || 77.2177;
  const user = username || 'Unknown User';

  // Fetch current contacts list (either from Supabase or local memory) to notify
  let contactsToNotify = [...emergencyContacts];
  try {
    const { data: contactsList, error } = await supabase
      .from('emergency_contacts')
      .select('*');
    
    if (!error && contactsList && contactsList.length > 0) {
      contactsToNotify = contactsList;
    }
  } catch (contactsFetchError) {
    // Ignored: fallback list is already populated
  }

  console.log('\n======================================================');
  console.log(`🎙️  REAL-TIME PANIC AUDIO RECORDING STREAM RECEIVED`);
  console.log(`👤 USER: ${user}`);
  console.log(`📍 CO-ORDINATES: Lat ${locationLat}, Lng ${locationLng}`);
  console.log(`⏰ TIME: ${currentTimestamp}`);
  console.log('------------------------------------------------------');
  
  if (audioData) {
    console.log(`📦 STREAM DATA SIZE: ${Math.round(audioData.length / 1024)} KB (Base64 WAV/WEBM format)`);
  } else {
    console.log(`⚠️  Warning: Received empty audio stream payload.`);
  }

  console.log('✉️  RELAYING AUDIO LINK & COORDINATES TO TRUSTED CIRCLE:');
  contactsToNotify.forEach(contact => {
    console.log(`   👉 Dispatched SMS to: ${contact.name} (${contact.phone})`);
    console.log(`      Text: "🚨 WARNING! AANCHAL detected muffled panic sounds. User might be in danger. Live location: https://maps.google.com/?q=${locationLat},${locationLng}. Listen to live mic recording: http://localhost:5000/api/audio/stream-id-${Date.now()}"`);
  });

  console.log('🚨 FORWARDING STREAM DIRECTLY TO 112 DISPATCH OPERATORS... ACTIVE.');
  console.log('======================================================\n');

  res.status(200).json({
    success: true,
    message: 'Muffled scream audio feed and coordinates uploaded and broadcasted successfully',
    streamId: `stream-${Date.now()}`
  });
});

// ─── Startup: seed admin user & test Supabase connection ────────────────────
async function seedAdminUser() {
  try {
    // Test connection first
    const { error: pingError } = await supabase.from('users').select('id').limit(1);
    if (pingError) {
      console.warn('⚠️  Supabase ping failed:', pingError.message);
      console.warn('   Running in LOCAL MEMORY MODE — data will reset on restart.\n');
      return;
    }

    console.log('✅ Supabase connected successfully!');

    // Upsert admin user (insert if not exists, skip if already there)
    const { error: seedError } = await supabase
      .from('users')
      .upsert(
        { username: 'admin', phone: '9876543210', password: '1234' },
        { onConflict: 'username', ignoreDuplicates: true }
      );

    if (seedError) {
      console.warn('⚠️  Could not seed admin user:', seedError.message);
    } else {
      console.log('👤 Default admin account ready — username: admin | password: 1234');
    }
  } catch (err) {
    console.warn('⚠️  Supabase startup check failed:', err.message);
    console.warn('   Running in LOCAL MEMORY MODE.\n');
  }
}

app.listen(PORT, async () => {
  console.log(`\n🚀 AANCHAL secure backend listening on port ${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await seedAdminUser();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
