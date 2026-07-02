const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

// User authentication storage
let registeredUsers = [
  { username: 'admin', phone: '9876543210', password: 'password' }
];

// User Registration Endpoint
app.post('/api/register', (req, res) => {
  const { username, phone, password } = req.body;
  if (!username || !phone || !password) {
    return res.status(400).json({ error: 'All fields (Username, Phone Number, Password) are required' });
  }

  // Clean up input values
  const cleanUsername = username.trim();
  const cleanPhone = phone.trim().replace(/\s+/g, '');

  // Check if username or phone already exists
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
  console.log(`👤 NEW USER REGISTERED: ${newUser.username} (${newUser.phone})`);
  
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    user: { username: newUser.username, phone: newUser.phone }
  });
});

// User Login Endpoint (Supports Username OR Phone Login)
app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body; // 'identifier' is username or phone
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter Username/Phone and Password' });
  }

  const cleanIdentifier = identifier.trim().replace(/\s+/g, '');

  const user = registeredUsers.find(u => 
    (u.username.toLowerCase() === cleanIdentifier.toLowerCase() || u.phone === cleanIdentifier) && 
    u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid Username/Phone number or Password' });
  }

  console.log(`🔓 USER LOGGED IN: ${user.username}`);
  res.status(200).json({
    success: true,
    username: user.username,
    phone: user.phone
  });
});

// ─── OTP Store (in-memory) ─────────────────────────────────────────────────
// Structure: { phone: { otp, expiresAt } }
const otpStore = {};

// Helper: generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 3a. Send OTP for Forgot Password
app.post('/api/forgot-password', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  const cleanPhone = phone.trim().replace(/\s+/g, '');

  // Find the registered user by phone
  const user = registeredUsers.find(u => u.phone === cleanPhone);
  if (!user) {
    return res.status(404).json({ error: 'No account found with this phone number.' });
  }

  // Generate OTP and store with 10-minute expiry
  const otp = generateOTP();
  otpStore[cleanPhone] = {
    otp,
    username: user.username,
    expiresAt: Date.now() + 10 * 60 * 1000   // 10 minutes
  };

  // Simulate SMS dispatch
  console.log('\n══════════════════════════════════════════════════');
  console.log(`📲 AANCHAL OTP DISPATCH — Forgot Password`);
  console.log(`👤 User: ${user.username}`);
  console.log(`📞 Phone: ${cleanPhone}`);
  console.log(`🔑 OTP (simulated SMS): ${otp}`);
  console.log(`⏰ Valid for: 10 minutes`);
  console.log(`📩 SMS Content: "Your AANCHAL password reset OTP is: ${otp}. Valid for 10 minutes. Do not share this with anyone."`);
  console.log('══════════════════════════════════════════════════\n');

  res.status(200).json({
    success: true,
    message: `OTP sent successfully to +91-${cleanPhone.slice(-10)}.`,
    // In production, NEVER return OTP in response — only for demo/workspace purposes:
    demoOtp: otp
  });
});

// 3b. Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required.' });
  }

  const cleanPhone = phone.trim().replace(/\s+/g, '');
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

  // Mark OTP as verified (don't delete yet — needed for reset step)
  otpStore[cleanPhone].verified = true;

  console.log(`✅ OTP VERIFIED for ${record.username} (${cleanPhone})`);
  res.status(200).json({ success: true, message: 'OTP verified successfully.' });
});

// 3c. Reset Password (after OTP verified)
app.post('/api/reset-password', (req, res) => {
  const { phone, otp, newPassword } = req.body;
  if (!phone || !otp || !newPassword) {
    return res.status(400).json({ error: 'Phone, OTP, and new password are required.' });
  }

  const cleanPhone = phone.trim().replace(/\s+/g, '');
  const record = otpStore[cleanPhone];

  if (!record || !record.verified || record.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid or unverified OTP. Please restart the reset process.' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[cleanPhone];
    return res.status(400).json({ error: 'Session expired. Please request a new OTP.' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
  }

  // Update password
  const userIndex = registeredUsers.findIndex(u => u.phone === cleanPhone);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  registeredUsers[userIndex].password = newPassword;
  delete otpStore[cleanPhone];   // Invalidate OTP after use

  console.log(`🔐 PASSWORD RESET SUCCESSFUL for ${registeredUsers[userIndex].username} (${cleanPhone})`);
  res.status(200).json({ success: true, message: 'Password reset successfully. You can now sign in.' });
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
app.get('/api/contacts', (req, res) => {
  res.json(emergencyContacts);
});

app.post('/api/contacts', (req, res) => {
  const { name, phone, relationship } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone number are required' });
  }
  const newContact = {
    id: Date.now().toString(),
    name,
    phone,
    relationship: relationship || 'Friend'
  };
  emergencyContacts.push(newContact);
  res.status(201).json(newContact);
});

app.delete('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  emergencyContacts = emergencyContacts.filter(c => c.id !== id);
  res.json({ message: 'Contact removed successfully' });
});

// 4. Alert Trigger API
// Simulates sending SMS and notifying emergency services
app.post('/api/alert', (req, res) => {
  const { lat, lng, type, timestamp } = req.body;
  
  const alertRecord = {
    id: `alert-${Date.now()}`,
    lat: lat || 28.6304,
    lng: lng || 77.2177,
    type: type || 'VOICE_TRIGGER',
    timestamp: timestamp || new Date().toISOString()
  };

  distressAlerts.push(alertRecord);

  console.log('\n======================================================');
  console.log(`🚨 DANGER SIGNAL RECEIVED AT [${alertRecord.timestamp}]`);
  console.log(`📡 SOURCE: ${alertRecord.type}`);
  console.log(`📍 LOCATION: Latitude ${alertRecord.lat}, Longitude ${alertRecord.lng}`);
  console.log('------------------------------------------------------');
  console.log('✉️  SENDING SIMULATED SOS SMS TO PRE-SAVED CONTACTS:');
  
  emergencyContacts.forEach(contact => {
    console.log(`   👉 To: ${contact.name} (${contact.phone})`);
    console.log(`      Content: "🚨 EMERGENCY! AANCHAL safety shield triggered. I need help. My current location: https://maps.google.com/?q=${alertRecord.lat},${alertRecord.lng}"`);
  });
  
  console.log('📞 DISPATCHING ALERT TO POLICE CONTROL ROOM (112)... DONE.');
  console.log('======================================================\n');

  res.status(200).json({
    success: true,
    message: 'Distress alerts dispatched successfully',
    alertDetails: alertRecord,
    notifiedContacts: emergencyContacts
  });
});

// 5. Muffled Screaming Real-Time Audio Streaming API
app.post('/api/upload-recording', (req, res) => {
  const { lat, lng, username, audioData, timestamp } = req.body;

  const currentTimestamp = timestamp || new Date().toISOString();
  const locationLat = lat || 28.6304;
  const locationLng = lng || 77.2177;
  const user = username || 'Unknown User';

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
  emergencyContacts.forEach(contact => {
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

app.listen(PORT, () => {
  console.log(`🚀 AANCHAL secure backend listening on port ${PORT}`);
});
