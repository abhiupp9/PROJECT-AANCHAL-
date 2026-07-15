import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Map, 
  Heart, 
  Users, 
  Phone, 
  Mic, 
  MicOff, 
  MapPin, 
  AlertTriangle, 
  Navigation, 
  Eye, 
  Lock, 
  Unlock, 
  Check, 
  Plus, 
  Trash2,
  AlertCircle,
  Radio,
  Video,
  LogOut,
  UserCheck,
  Activity
} from 'lucide-react';
import CryptoJS from 'crypto-js';
import { startVoiceRecognition, stopVoiceRecognition } from '../utils/voiceListener';
import { startHmmDetection, stopHmmDetection, isHmmDetectionActive } from '../utils/hmmDetector';
import AcronymInfo from './AcronymInfo';

// Fallback Leaflet import if L is loaded from CDN/module
// We'll use window.L since we loaded Leaflet's assets
const getL = () => window.L;

export default function Dashboard({ username, onSignOut }) {
  const [activeTab, setActiveTab] = useState('help');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Volunteer & Real-time GPS Tracker state
  const [isRegisteredVolunteer, setIsRegisteredVolunteer] = useState(false);
  const [nearbyVolunteers, setNearbyVolunteers] = useState([
    { id: 1, name: 'Rohit Sharma (Specialist)', phone: '+91 9911223344', relationship: 'Official Rescue', status: 'Active', distance: 320, lat: 28.6325, lng: 77.2205 },
    { id: 2, name: 'Priya Patel (Safety Volunteer)', phone: '+91 9876543211', relationship: 'Citizen Guard', status: 'Active', distance: 480, lat: 28.6285, lng: 77.2145 },
    { id: 3, name: 'Vikram Singh (First Aid)', phone: '+91 9123456789', relationship: 'Neighbor Node', status: 'Active', distance: 650, lat: 28.6255, lng: 77.2185 }
  ]);
  const [volunteerRequestStatus, setVolunteerRequestStatus] = useState('idle'); // idle | searching | connected | arrived
  const [escortVolunteer, setEscortVolunteer] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [isWalking, setIsWalking] = useState(false);

  const volunteerMapRef = useRef(null);
  const leafletVolunteerMapInstance = useRef(null);
  const volunteerUserMarkerRef = useRef(null);
  const volMarkersRef = useRef({});
  const escortMarkerRef = useRef(null);
  const escortPathPolylineRef = useRef(null);

  const walkIntervalRef = useRef(null);
  const watchIdRef = useRef(null);
  
  // Voice Listener State
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('stopped');

  // Contacts State
  const [contacts, setContacts] = useState([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRel, setNewContactRel] = useState('Family');

  // Logs state
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), text: 'AANCHAL safety core initialized.' },
    { time: new Date().toLocaleTimeString(), text: 'Shield mode set to ARMED.' }
  ]);

  // Health / Medical Shield State
  const [pin, setPin] = useState('');
  const [isMedCardLoaded, setIsMedCardLoaded] = useState(false);
  const [isCardEncrypted, setIsCardEncrypted] = useState(false);
  const [cardForm, setCardForm] = useState({
    name: '',
    bloodGroup: 'O+',
    allergies: '',
    illnesses: '',
    medications: '',
    doctor: ''
  });
  const [decryptedForm, setDecryptedForm] = useState(null);
  const [pinError, setPinError] = useState('');

  // Map / Home State
  const mapRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const userMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const elementsLayerGroupRef = useRef(null);
  const [safeCorridors, setSafeCorridors] = useState([]);
  const [securityElements, setSecurityElements] = useState([]);
  const [mapCenter, setMapCenter] = useState({ lat: 28.6304, lng: 77.2177 }); // Default: Delhi CP
  const [deviationAlert, setDeviationAlert] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);

  // Siren Audio refs
  const audioCtxRef = useRef(null);
  const osc1Ref = useRef(null);
  const osc2Ref = useRef(null);
  const gainNodeRef = useRef(null);

  // Hmm-Hmm Muffled Vocal Sensor state
  const [isHmmArmed, setIsHmmArmed] = useState(false);
  const [hmmStatus, setHmmStatus] = useState('idle'); // idle | detecting | triggered | error | unsupported
  const [hmmRecording, setHmmRecording] = useState(false);
  const [hmmCountdown, setHmmCountdown] = useState(0);
  const hmmCountdownRef = useRef(null);

  // Add a log entry
  const addLog = (text) => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), text }, ...prev]);
  };

  // Fetch initial contacts and corridors from server
  useEffect(() => {
    fetchContacts();
    fetchCorridors();
    loadMedCardState();

    // Start background voice listener by default
    toggleVoiceListener();

    return () => {
      stopSiren();
      stopVoiceRecognition();
      stopHmmDetection();
      if (hmmCountdownRef.current) clearInterval(hmmCountdownRef.current);
      if (walkIntervalRef.current) clearInterval(walkIntervalRef.current);
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/contacts');
      const data = await res.json();
      setContacts(data);
    } catch (e) {
      console.error("Failed to load contacts from server:", e);
      addLog("⚠️ Failed to load contacts from cloud database. Using cached copy.");
    }
  };

  const fetchCorridors = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/safe-corridors');
      const data = await res.json();
      setSafeCorridors(data.corridors || []);
      setSecurityElements(data.securityElements || []);
      setMapCenter(data.center || { lat: 28.6304, lng: 77.2177 });
    } catch (e) {
      console.error("Failed to load safe corridors:", e);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContactName || !newContactPhone) return;

    try {
      const res = await fetch('http://localhost:5000/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContactName,
          phone: newContactPhone,
          relationship: newContactRel
        })
      });
      const data = await res.json();
      setContacts(prev => [...prev, data]);
      setNewContactName('');
      setNewContactPhone('');
      addLog(`Added emergency contact: ${data.name}`);
    } catch (err) {
      console.error(err);
      addLog("⚠️ Error saving contact to database.");
    }
  };

  const handleDeleteContact = async (id, name) => {
    try {
      await fetch(`http://localhost:5000/api/contacts/${id}`, { method: 'DELETE' });
      setContacts(prev => prev.filter(c => c.id !== id));
      addLog(`Removed emergency contact: ${name}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Live GPS Distance calculation (Haversine Formula)
  const getHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const recalculateVolunteerDistances = (userLat, userLng) => {
    setNearbyVolunteers(prev => 
      prev.map(vol => {
        const dist = Math.round(getHaversineDistance(userLat, userLng, vol.lat, vol.lng));
        return { ...vol, distance: dist };
      })
    );
  };

  // Real-time GPS Location tracking via browser Geolocation watchPosition
  const startRealTimeTracking = () => {
    if (!navigator.geolocation) {
      addLog("⚠️ Geolocation is not supported by your browser.");
      return;
    }
    
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
      setWatchId(null);
      addLog("📍 Real-time GPS satellite watch DEACTIVATED.");
      return;
    }

    addLog("📍 Real-time GPS satellite watch ACTIVE. Tracking movements...");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setGpsLocation(loc);
        addLog(`📍 GPS position updated: Lat ${loc.lat.toFixed(5)}, Lng ${loc.lng.toFixed(5)}`);
        
        // Update both map markers in real-time
        if (leafletMapInstance.current) {
          leafletMapInstance.current.panTo([loc.lat, loc.lng]);
          if (userMarkerRef.current) userMarkerRef.current.setLatLng([loc.lat, loc.lng]);
        }
        if (leafletVolunteerMapInstance.current) {
          leafletVolunteerMapInstance.current.panTo([loc.lat, loc.lng]);
          if (volunteerUserMarkerRef.current) volunteerUserMarkerRef.current.setLatLng([loc.lat, loc.lng]);
        }
        
        recalculateVolunteerDistances(loc.lat, loc.lng);
      },
      (err) => {
        addLog(`⚠️ Geolocation watch failed: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
    watchIdRef.current = id;
    setWatchId(id);
  };

  // Walking simulation for desktop environments to trace coordinates in real time
  const startWalkingSimulation = () => {
    if (isWalking) {
      clearInterval(walkIntervalRef.current);
      walkIntervalRef.current = null;
      setIsWalking(false);
      addLog("🧭 GPS walking simulation stopped.");
      return;
    }

    setIsWalking(true);
    addLog("🧭 GPS walking simulation active. User is moving in real-time...");
    
    let angle = 0;
    const centerLat = gpsLocation?.lat || mapCenter.lat;
    const centerLng = gpsLocation?.lng || mapCenter.lng;
    
    const id = setInterval(() => {
      angle += 0.1; // walk step
      const newLat = centerLat + Math.sin(angle) * 0.001;
      const newLng = centerLng + Math.cos(angle) * 0.001;
      
      const newLoc = { lat: newLat, lng: newLng, accuracy: 5.0 };
      setGpsLocation(newLoc);
      
      // Pan/Update markers
      if (leafletMapInstance.current) {
        leafletMapInstance.current.panTo([newLat, newLng]);
        if (userMarkerRef.current) userMarkerRef.current.setLatLng([newLat, newLng]);
      }
      if (leafletVolunteerMapInstance.current) {
        leafletVolunteerMapInstance.current.panTo([newLat, newLng]);
        if (volunteerUserMarkerRef.current) volunteerUserMarkerRef.current.setLatLng([newLat, newLng]);
      }
      
      recalculateVolunteerDistances(newLat, newLng);
    }, 1500);

    walkIntervalRef.current = id;
    setIsWalking(true);
  };

  // Dispatch nearest safety volunteer towards user coordinate
  const requestVolunteerEscort = () => {
    if (volunteerRequestStatus !== 'idle') return;

    setVolunteerRequestStatus('searching');
    addLog("🔍 Searching for active safety volunteers in your 1km radius...");

    setTimeout(() => {
      // Find the nearest volunteer
      let nearest = nearbyVolunteers[0];
      nearbyVolunteers.forEach(v => {
        if (v.distance < nearest.distance) nearest = v;
      });

      setVolunteerRequestStatus('connected');
      setEscortVolunteer(nearest);
      addLog(`🤝 Connection established! Safety responder ${nearest.name} is dispatched to your coordinates.`);

      // Simulate movement of volunteer towards the user
      const userLat = gpsLocation?.lat || mapCenter.lat;
      const userLng = gpsLocation?.lng || mapCenter.lng;

      const startLat = nearest.lat;
      const startLng = nearest.lng;

      let step = 0;
      const totalSteps = 10;
      
      const moveInterval = setInterval(() => {
        step++;
        const ratio = step / totalSteps;
        const currentLat = startLat + (userLat - startLat) * ratio;
        const currentLng = startLng + (userLng - startLng) * ratio;

        // Update coordinate
        setNearbyVolunteers(prev => 
          prev.map(v => v.id === nearest.id ? { ...v, lat: currentLat, lng: currentLng } : v)
        );

        // Update volunteer marker on map
        if (leafletVolunteerMapInstance.current && escortMarkerRef.current) {
          escortMarkerRef.current.setLatLng([currentLat, currentLng]);
          
          // Re-draw path line connecting volunteer to user
          if (escortPathPolylineRef.current) {
            escortPathPolylineRef.current.setLatLngs([[userLat, userLng], [currentLat, currentLng]]);
          } else {
            const L = getL();
            if (L) {
              escortPathPolylineRef.current = L.polyline([[userLat, userLng], [currentLat, currentLng]], {
                color: '#a855f7',
                weight: 4,
                dashArray: '5, 10'
              }).addTo(leafletVolunteerMapInstance.current);
            }
          }
        }

        // Recalculate distance
        const dist = Math.round(getHaversineDistance(userLat, userLng, currentLat, currentLng));
        setNearbyVolunteers(prev => 
          prev.map(v => v.id === nearest.id ? { ...v, distance: dist } : v)
        );

        addLog(`🏃 Responder ${nearest.name} is closing in. Distance: ${dist} meters.`);

        if (step >= totalSteps) {
          clearInterval(moveInterval);
          setVolunteerRequestStatus('arrived');
          addLog(`💚 Responder ${nearest.name} has arrived at your location. Safe escort secured!`);
          
          if (escortPathPolylineRef.current) {
            escortPathPolylineRef.current.remove();
            escortPathPolylineRef.current = null;
          }
        }
      }, 1500);

    }, 2000);
  };

  // Volunteer tab Leaflet Map handlers
  useEffect(() => {
    if (activeTab === 'volunteers') {
      const timer = setTimeout(() => {
        initVolunteerMap();
      }, 100);
      return () => {
        clearTimeout(timer);
        destroyVolunteerMap();
      };
    }
  }, [activeTab, nearbyVolunteers]);

  const initVolunteerMap = () => {
    const L = getL();
    if (!L || !volunteerMapRef.current) return;
    if (leafletVolunteerMapInstance.current) {
      const userLat = gpsLocation?.lat || mapCenter.lat;
      const userLng = gpsLocation?.lng || mapCenter.lng;
      if (volunteerUserMarkerRef.current) {
        volunteerUserMarkerRef.current.setLatLng([userLat, userLng]);
      }
      return;
    }

    const userLat = gpsLocation?.lat || mapCenter.lat;
    const userLng = gpsLocation?.lng || mapCenter.lng;

    const map = L.map(volunteerMapRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([userLat, userLng], 15);

    leafletVolunteerMapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Draw user position marker
    const userMarkerHtml = `<div style="
      background-color: #3b82f6; 
      width: 18px; 
      height: 18px; 
      border-radius: 50%; 
      border: 3px solid white;
      box-shadow: 0 0 10px #3b82f6;
    " class="secure-pulse"></div>`;

    const userIcon = L.divIcon({
      html: userMarkerHtml,
      className: 'user-marker-vol',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    volunteerUserMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon }).addTo(map);

    // Draw volunteer markers
    nearbyVolunteers.forEach(vol => {
      const isEscort = escortVolunteer && escortVolunteer.id === vol.id;
      const volMarkerHtml = `<div style="
        background-color: ${isEscort ? '#a855f7' : '#22c55e'}; 
        width: 16px; 
        height: 16px; 
        border-radius: 50%; 
        border: 2px solid white;
        box-shadow: 0 0 8px ${isEscort ? '#a855f7' : '#22c55e'};
      "></div>`;

      const volIcon = L.divIcon({
        html: volMarkerHtml,
        className: 'vol-marker-' + vol.id,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const m = L.marker([vol.lat, vol.lng], { icon: volIcon }).addTo(map)
        .bindPopup(`<b>${vol.name}</b><br/>📱 ${vol.phone}<br/>📍 Distance: ${vol.distance}m`);
      
      volMarkersRef.current[vol.id] = m;
      if (isEscort) {
        escortMarkerRef.current = m;
      }
    });
  };

  const destroyVolunteerMap = () => {
    if (leafletVolunteerMapInstance.current) {
      leafletVolunteerMapInstance.current.remove();
      leafletVolunteerMapInstance.current = null;
      volunteerUserMarkerRef.current = null;
      volMarkersRef.current = {};
      escortMarkerRef.current = null;
      if (escortPathPolylineRef.current) {
        escortPathPolylineRef.current.remove();
        escortPathPolylineRef.current = null;
      }
    }
  };

  // continuous Speech Recognition listener
  const toggleVoiceListener = () => {
    if (isVoiceListening) {
      stopVoiceRecognition();
      setIsVoiceListening(false);
      setVoiceStatus('stopped');
      addLog("🎙️ Voice trigger listener DEACTIVATED.");
    } else {
      setIsVoiceListening(true);
      setVoiceStatus('listening');
      addLog("🎙️ Background Voice Recognition armed. Say 'HELP! HELP! HELP!' to trigger SOS.");
      startVoiceRecognition(
        // Trigger Action
        () => {
          triggerEmergency("VOICE_TRIGGER");
        },
        // Status updates
        (status) => {
          setVoiceStatus(status);
        }
      );
    }
  };

  // Geolocation lookup
  const getGpsPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject("Geolocation unsupported by browser.");
        return;
      }
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setGpsLocation(loc);
          setGpsLoading(false);
          resolve(loc);
        },
        (err) => {
          setGpsLoading(false);
          reject(err.message);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  // Sirens Sound synthesizer using AudioContext
  const playSiren = () => {
    try {
      if (audioCtxRef.current) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.7, ctx.currentTime);
      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;

      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(700, ctx.currentTime);
      osc1.connect(gainNode);
      osc1Ref.current = osc1;

      // Frequency Sweep Modulator
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2.5, ctx.currentTime); // 2.5Hz modulation sweep rate
      osc2Ref.current = osc2;

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(200, ctx.currentTime); // sweep width
      
      osc2.connect(lfoGain);
      lfoGain.connect(osc1.frequency);

      osc1.start();
      osc2.start();
    } catch (e) {
      console.error("Audio Context failed to start:", e);
    }
  };

  const stopSiren = () => {
    try {
      if (osc1Ref.current) { osc1Ref.current.stop(); osc1Ref.current.disconnect(); osc1Ref.current = null; }
      if (osc2Ref.current) { osc2Ref.current.stop(); osc2Ref.current.disconnect(); osc2Ref.current = null; }
      if (gainNodeRef.current) { gainNodeRef.current.disconnect(); gainNodeRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger AANCHAL emergency flow
  const triggerEmergency = async (source = "MANUAL_BUTTON") => {
    if (isEmergencyActive) return; // Prevent double trigger

    setIsEmergencyActive(true);
    setActiveTab('help'); // Force redirect to active dashboard
    playSiren();
    addLog(`🚨 SHIELD DEPLOYED! Emergency SOS triggered via [${source}]`);

    let loc = { lat: 28.6304, lng: 77.2177 }; // fallback Default CP Delhi
    try {
      addLog("📍 Fetching precise GPS location...");
      loc = await getGpsPosition();
      addLog(`📍 Location locked! Coordinates: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
    } catch (err) {
      console.warn("Could not fetch GPS. Defaulting to CP Delhi center.", err);
      addLog(`⚠️ GPS failed: "${err}". Dispatching with estimate coordinates.`);
    }

    try {
      addLog("📡 Contacting secure cloud relay server...");
      const res = await fetch('http://localhost:5000/api/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: loc.lat,
          lng: loc.lng,
          type: source,
          timestamp: new Date().toISOString()
        })
      });
      const result = await res.json();
      
      if (result.success) {
        addLog("✉️ SMS SOS alerts sent to pre-saved family and support lines.");
        addLog("📞 Emergency Dispatch (112) notified with live tracking link.");
      }
    } catch (e) {
      console.error(e);
      addLog("⚠️ Connection error to cloud alert relay. Retrying locally over cell link simulation...");
      addLog(`✉️ Local SOS SMS simulation: Sent alert to ${contacts.length} saved contacts.`);
    }
  };

  const deactivateEmergency = () => {
    setIsEmergencyActive(false);
    stopSiren();
    addLog("✅ Emergency shield deactivated. Re-arming system...");
  };

  // Map render handles
  useEffect(() => {
    if (activeTab === 'home') {
      // Small timeout to allow the DOM node to size itself properly
      const timer = setTimeout(() => {
        initMap();
      }, 100);
      return () => {
        clearTimeout(timer);
        destroyMap();
      };
    }
  }, [activeTab, safeCorridors, securityElements]);

  const initMap = () => {
    const L = getL();
    if (!L || !mapRef.current) return;
    if (leafletMapInstance.current) return;

    // Create Leaflet instance
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([mapCenter.lat, mapCenter.lng], 15);

    leafletMapInstance.current = map;

    // Dark styled street tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Group for security elements
    const elementsGroup = L.layerGroup().addTo(map);
    elementsLayerGroupRef.current = elementsGroup;

    // Load Safe Corridor routes
    safeCorridors.forEach(corridor => {
      // Select polyline color based on safety score
      let color = '#a855f7'; // Purple default
      if (corridor.safetyScore >= 90) color = '#06b6d4'; // Cyan - Very Safe
      if (corridor.safetyScore < 80) color = '#f43f5e';  // Red - Caution

      const polyline = L.polyline(corridor.polyline, {
        color: color,
        weight: 6,
        opacity: 0.8,
        dashArray: '1, 10',
        lineCap: 'round'
      }).addTo(map);
      
      polyline.bindPopup(`
        <div style="color: #0f172a; font-family: sans-serif; font-size: 13px;">
          <strong style="color: #6d28d9">${corridor.name}</strong><br/>
          🛡️ Safety Rating: <strong>${corridor.safetyScore}%</strong><br/>
          📹 CCTV Nodes: ${corridor.features.cctvCount}<br/>
          🚨 Police Booths: ${corridor.features.policeCheckpoints}
        </div>
      `);
    });

    // Load Security Elements (CCTV, Police Booths)
    securityElements.forEach(elem => {
      let iconColor = '#06b6d4'; // CCTV
      if (elem.type === 'Police Booth') iconColor = '#a855f7';
      if (elem.type === 'Smart Light') iconColor = '#eab308';

      const customHtml = `<div style="
        background-color: ${iconColor}; 
        width: 14px; 
        height: 14px; 
        border-radius: 50%; 
        border: 2px solid white;
        box-shadow: 0 0 8px ${iconColor};
      "></div>`;

      const markerIcon = L.divIcon({
        html: customHtml,
        className: 'custom-map-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      L.marker([elem.lat, elem.lng], { icon: markerIcon })
        .addTo(elementsGroup)
        .bindPopup(`
          <div style="color: #0f172a; font-family: sans-serif; font-size:12px;">
            <b>${elem.type}:</b> ${elem.name}<br/>
            🟢 Status: ${elem.status}
          </div>
        `);
    });

    // Create user position marker
    const userMarkerHtml = `<div style="
      background-color: #3b82f6; 
      width: 18px; 
      height: 18px; 
      border-radius: 50%; 
      border: 3px solid white;
      box-shadow: 0 0 10px #3b82f6;
    " class="secure-pulse"></div>`;

    const userIcon = L.divIcon({
      html: userMarkerHtml,
      className: 'user-marker',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    const userMarker = L.marker([mapCenter.lat, mapCenter.lng], { icon: userIcon }).addTo(map);
    userMarkerRef.current = userMarker;
  };

  const destroyMap = () => {
    if (leafletMapInstance.current) {
      leafletMapInstance.current.remove();
      leafletMapInstance.current = null;
      userMarkerRef.current = null;
      routePolylineRef.current = null;
      elementsLayerGroupRef.current = null;
    }
  };

  // Safe Navigation Simulation Functions
  const startNavigationSimulation = () => {
    if (!leafletMapInstance.current || safeCorridors.length === 0) return;
    setIsSimulating(true);
    setDeviationAlert(false);
    setSimStep(0);
    addLog("🧭 Safe route navigation simulation started.");
  };

  useEffect(() => {
    let simInterval = null;
    if (isSimulating && activeTab === 'home') {
      const activeCorridor = safeCorridors[0]; // Simulate on Outer Circle
      const pathPoints = activeCorridor.polyline;

      simInterval = setInterval(() => {
        if (simStep < pathPoints.length) {
          const nextCoord = pathPoints[simStep];
          updateSimulatedUserLocation(nextCoord[0], nextCoord[1]);
          setSimStep(prev => prev + 1);
          addLog(`🧭 Simulating route tracking: Node ${simStep + 1}/${pathPoints.length}`);
        } else {
          setIsSimulating(false);
          addLog("🟢 Simulated safe route navigation completed successfully.");
        }
      }, 2000);
    }
    return () => clearInterval(simInterval);
  }, [isSimulating, simStep, activeTab]);

  const updateSimulatedUserLocation = (lat, lng) => {
    const L = getL();
    if (!L || !leafletMapInstance.current || !userMarkerRef.current) return;

    // Pan to position
    leafletMapInstance.current.panTo([lat, lng]);

    // Update marker location
    userMarkerRef.current.setLatLng([lat, lng]);
  };

  const simulatePathDeviation = () => {
    if (!leafletMapInstance.current || !userMarkerRef.current) return;
    setIsSimulating(false);
    setDeviationAlert(true);
    addLog("⚠️ DEVIATION DETECTED! Route tracking system reports user went off safe corridor!");

    // Teleport simulated marker off-path (e.g. into an dark alleyway coordinate)
    const deviationCoord = [28.6335, 77.2115];
    updateSimulatedUserLocation(deviationCoord[0], deviationCoord[1]);

    // Trigger local audio warning
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch(e){}

    // Auto-trigger Emergency SOS on deviation
    setTimeout(() => {
      triggerEmergency("ROUTE_DEVIATION_DETECTOR");
    }, 1500);
  };

  // Encrypted Medical Shield logic
  const loadMedCardState = () => {
    const encryptedData = localStorage.getItem('aanchal_med_card_encrypted');
    if (encryptedData) {
      setIsCardEncrypted(true);
      setIsMedCardLoaded(true);
    } else {
      const rawData = localStorage.getItem('aanchal_med_card_raw');
      if (rawData) {
        setCardForm(JSON.parse(rawData));
        setIsMedCardLoaded(true);
      }
    }
  };

  const handleEncryptMedCard = () => {
    if (!pin || pin.length < 4) {
      setPinError("Encryption key (PIN) must be at least 4 digits.");
      return;
    }
    setPinError('');

    try {
      const encryptedString = CryptoJS.AES.encrypt(JSON.stringify(cardForm), pin).toString();
      localStorage.setItem('aanchal_med_card_encrypted', encryptedString);
      localStorage.removeItem('aanchal_med_card_raw');
      setIsCardEncrypted(true);
      setDecryptedForm(null);
      setPin('');
      addLog("🛡️ Medical Shield encrypted successfully. Details locked on device.");
    } catch (e) {
      setPinError("Failed to encrypt data.");
    }
  };

  const handleDecryptMedCard = () => {
    if (!pin) {
      setPinError("Enter your secure PIN to decrypt.");
      return;
    }
    setPinError('');

    const encryptedString = localStorage.getItem('aanchal_med_card_encrypted');
    if (!encryptedString) return;

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedString, pin);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) {
        setPinError("Invalid PIN code. Access denied.");
        return;
      }

      const parsedData = JSON.parse(decryptedString);
      setDecryptedForm(parsedData);
      setPinError('');
      addLog("🔓 Medical Shield decrypted successfully.");
    } catch (e) {
      setPinError("Invalid PIN code. Access denied.");
    }
  };

  const handleSaveRawCard = (e) => {
    e.preventDefault();
    localStorage.setItem('aanchal_med_card_raw', JSON.stringify(cardForm));
    setIsMedCardLoaded(true);
    addLog("💾 Emergency Medical Card saved locally.");
  };

  const handleClearMedCard = () => {
    localStorage.removeItem('aanchal_med_card_encrypted');
    localStorage.removeItem('aanchal_med_card_raw');
    setCardForm({
      name: '',
      bloodGroup: 'O+',
      allergies: '',
      illnesses: '',
      medications: '',
      doctor: ''
    });
    setDecryptedForm(null);
    setIsCardEncrypted(false);
    setIsMedCardLoaded(false);
    addLog("🗑️ Medical Shield wiped clean.");
  };

  return (
    <div style={styles.appWrapper} className={isEmergencyActive || deviationAlert ? 'danger-flash-active' : ''}>
      
      {/* Side Navigation panel */}
      <div style={styles.sidebar} className="glass-container">
        <div style={styles.brand}>
          <Shield size={28} color="#06b6d4" className="secure-pulse" />
          <h2 style={styles.brandText}>AANCHAL</h2>
        </div>

        <div style={styles.userProfile}>
          <div style={styles.userAvatar}>
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={styles.userName}>{username}</div>
            <div style={styles.userRole}>Armed Protection</div>
          </div>
        </div>

        {/* AANCHAL Acronym compact info in sidebar - moved to top */}
        <AcronymInfo compact={true} />

        <nav style={styles.navMenu}>
          <button 
            style={{ ...styles.navItem, ...(activeTab === 'help' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('help')}
          >
            <Shield size={20} />
            <span>HELP (Emergency)</span>
          </button>
          
          <button 
            style={{ ...styles.navItem, ...(activeTab === 'home' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('home')}
          >
            <Map size={20} />
            <span>HOME (Navigation)</span>
          </button>

          <button 
            style={{ ...styles.navItem, ...(activeTab === 'health' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('health')}
          >
            <Heart size={20} />
            <span>HEALTH (Med-Shield)</span>
          </button>

          <button 
            style={{ ...styles.navItem, ...(activeTab === 'contacts' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('contacts')}
          >
            <Users size={20} />
            <span>SOS Contacts ({contacts.length})</span>
          </button>

          <button 
            style={{ ...styles.navItem, ...(activeTab === 'volunteers' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('volunteers')}
          >
            <UserCheck size={20} />
            <span>Volunteers Around</span>
          </button>
        </nav>

        {/* Continuous background listener indicator */}
        <div style={styles.voiceIndicatorPanel}>
          <div style={styles.voiceIndicatorHeader}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Voice Trigger</span>
            <span style={{
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: voiceStatus === 'listening' ? '#22c55e' : '#ef4444'
            }}></span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 10px 0' }}>
            Say <b>"HELP! HELP! HELP!"</b> anytime.
          </p>
          <button 
            onClick={toggleVoiceListener}
            style={{
              ...styles.voiceBtn,
              backgroundColor: isVoiceListening ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)',
              borderColor: isVoiceListening ? '#ef4444' : '#06b6d4',
              color: isVoiceListening ? '#ef4444' : '#06b6d4',
            }}
          >
            {isVoiceListening ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{isVoiceListening ? 'Disable Listener' : 'Arm Listener'}</span>
          </button>
        </div>

        <button onClick={onSignOut} style={{ ...styles.signOutBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
          <LogOut size={16} />
          <span>Log Out (Exit)</span>
        </button>
      </div>

       {/* Main dashboard content container */}
      <main style={styles.mainContent}>
        
        {/* Top Header Bar displaying AANCHAL full name */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: 'rgba(10, 12, 22, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          marginBottom: '24px',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
        }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px', margin: 0 }}>
              AANCHAL: Women's Safety & Health Ecosystem
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#06b6d4', fontWeight: 600, margin: '2px 0 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              आँचल • AI Safety & Health Shield
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', padding: '6px 12px', borderRadius: '10px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
            <span style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 'bold' }}>SECURE LINK ACTIVE</span>
          </div>
        </header>

        {/* Tab 1: HELP (Instant Assistance Shield) */}
        {activeTab === 'help' && (
          <div className="animate-slideup" style={styles.tabContainer}>
            <div style={styles.gridTwoColumns}>
              
              {/* Emergency dispatch trigger and status */}
              <div className="glass-container" style={styles.cardHelp}>
                <h3 style={styles.cardTitle}>HELP: Distress Response System</h3>
                <p style={styles.cardDesc}>
                  On voice activation or pressing the SOS button below, the system captures real-time GPS coordinates and automatically dispatches emergency alerts to pre-saved contacts and 112 authorities.
                </p>

                <div style={styles.shieldPulseArea}>
                  {isEmergencyActive ? (
                    <button 
                      onClick={deactivateEmergency}
                      style={styles.sosButtonActive} 
                      className="danger-pulse"
                    >
                      <AlertTriangle size={64} color="#fff" />
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '10px' }}>CANCEL ALERT</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => triggerEmergency("MANUAL_BUTTON")} 
                      style={styles.sosButtonArmed} 
                      className="secure-pulse"
                    >
                      <Shield size={68} color="#06b6d4" />
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '10px', color: '#fff' }}>SOS SHIELD</span>
                    </button>
                  )}
                </div>

                <div style={styles.emergencyStatusPanel}>
                  <div style={styles.statusLabel}>System Armed Shield Status:</div>
                  <div style={{
                    ...styles.statusValue, 
                    color: isEmergencyActive ? '#f43f5e' : '#06b6d4',
                    textShadow: isEmergencyActive ? '0 0 10px rgba(244, 63, 94, 0.4)' : '0 0 10px rgba(6, 182, 212, 0.4)'
                  }}>
                    {isEmergencyActive ? '🚨 EMERGENCY SOS ACTIVE' : '🛡️ SYSTEM LOCKED & SECURE'}
                  </div>
                </div>

                <div style={styles.coordinateDisplay}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                    <MapPin size={18} />
                    <span>Real-time GPS Coordinate Feed:</span>
                  </div>
                  <div style={styles.gpsCoords}>
                    {gpsLoading ? (
                      <span style={{ color: '#06b6d4' }}>Accessing satellite feed...</span>
                    ) : gpsLocation ? (
                      <span>Lat: {gpsLocation.lat.toFixed(6)} | Lng: {gpsLocation.lng.toFixed(6)} <small style={{color: '#22c55e'}}>(±{gpsLocation.accuracy.toFixed(1)}m)</small></span>
                    ) : (
                      <span style={{ color: '#64748b' }}>GPS Idle. Ready for lock-on.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hmm-Hmm Muffled Vocal Panic Sensor Card */}
              <div className="glass-container" style={styles.cardHelp}>
                <h3 style={styles.cardTitle}>👄 Muffled Voice Panic Detector</h3>
                <p style={styles.cardDesc}>
                  Jab kisi women ka munh pakad liya jaye — device ke sensor se <b>Hmm-Hmm nasal sound</b> detect hogi. Auto-recording start hogi aur real-time audio + location family & 112 ko bheji jaayegi.
                </p>

                {/* Status Display */}
                <div style={{
                  ...styles.emergencyStatusPanel,
                  borderColor: hmmStatus === 'triggered' ? 'rgba(244,63,94,0.4)' : hmmStatus === 'detecting' ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.05)'
                }}>
                  <div style={styles.statusLabel}>Sensor Status:</div>
                  <div style={{
                    ...styles.statusValue,
                    fontSize: '1rem',
                    color: hmmStatus === 'triggered' ? '#f43f5e' : hmmStatus === 'detecting' ? '#06b6d4' : '#64748b',
                  }}>
                    {hmmStatus === 'idle' && '⬛ Disarmed — Click to activate'}
                    {hmmStatus === 'detecting' && '🟢 ARMED — Listening for panic Hmm sounds...'}
                    {hmmStatus === 'triggered' && '🔴 TRIGGERED — Recording & Relaying audio...'}
                    {hmmStatus === 'error' && '⚠️ Microphone access denied'}
                    {hmmStatus === 'unsupported' && '⚠️ Browser does not support audio capture'}
                  </div>
                </div>

                {/* Live audio level bars visualizer */}
                {isHmmArmed && hmmStatus === 'detecting' && (
                  <div style={styles.audioBarsWrapper}>
                    {[...Array(12)].map((_, i) => (
                      <div key={i} style={{
                        ...styles.audioBar,
                        animationDelay: `${i * 0.08}s`,
                        height: `${Math.random() * 30 + 8}px`,
                      }} className="hmm-bar" />
                    ))}
                    <span style={{ fontSize: '0.75rem', color: '#06b6d4', marginLeft: '10px' }}>Mic Active</span>
                  </div>
                )}

                {/* Recording countdown */}
                {hmmStatus === 'triggered' && hmmCountdown > 0 && (
                  <div style={styles.recordingBanner} className="danger-pulse">
                    <Video size={18} color="#f43f5e" />
                    <span>🔴 Recording: <b>{hmmCountdown}s</b> remaining — Uploading to cloud relay...</span>
                  </div>
                )}

                {/* Arm/Disarm Button */}
                <button
                  onClick={() => {
                    if (isHmmArmed) {
                      stopHmmDetection();
                      setIsHmmArmed(false);
                      setHmmStatus('idle');
                      if (hmmCountdownRef.current) clearInterval(hmmCountdownRef.current);
                      addLog('👂 Muffled vocal panic sensor DISARMED.');
                    } else {
                      setIsHmmArmed(true);
                      setHmmStatus('detecting');
                      addLog('👂 Muffled vocal panic sensor ARMED. Listening for Hmm-Hmm pattern...');
                      startHmmDetection({
                        onStatusChange: (s) => {
                          setHmmStatus(s);
                          if (s === 'triggered') {
                            setHmmRecording(true);
                            setHmmCountdown(8);
                            addLog('🔴 Hmm-Hmm panic sound DETECTED! Emergency recording started.');
                            addLog('📡 Uploading audio + GPS coordinates to server relay...');
                            triggerEmergency('MUFFLED_VOICE_TRIGGER');
                            hmmCountdownRef.current = setInterval(() => {
                              setHmmCountdown(prev => {
                                if (prev <= 1) {
                                  clearInterval(hmmCountdownRef.current);
                                  setHmmRecording(false);
                                  setHmmStatus('detecting');
                                  addLog('✅ Audio recording uploaded successfully to secure relay.');
                                  return 0;
                                }
                                return prev - 1;
                              });
                            }, 1000);
                          }
                        },
                        username,
                        lat: gpsLocation?.lat,
                        lng: gpsLocation?.lng,
                      });
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    width: '100%', padding: '14px',
                    borderRadius: '12px', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '0.95rem',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    transition: 'var(--transition-smooth)',
                    background: isHmmArmed
                      ? 'linear-gradient(135deg, #f43f5e, #be123c)'
                      : 'linear-gradient(135deg, #a855f7, #7e22ce)',
                    color: '#fff',
                    boxShadow: isHmmArmed
                      ? '0 4px 20px rgba(244,63,94,0.5)'
                      : '0 4px 20px rgba(168,85,247,0.5)',
                  }}
                >
                  <Radio size={20} />
                  {isHmmArmed ? 'DISARM Hmm Sensor' : 'ARM Hmm-Hmm Panic Sensor'}
                </button>

                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '10px', textAlign: 'center', lineHeight: '1.5' }}>
                  Microphone ka access dena zaroori hai. Sensor sirf low-frequency nasal hum detect karta hai.
                </div>
              </div>

              {/* Logs Activity Feed */}
              <div className="glass-container" style={styles.cardLogs}>
                <div style={styles.logsHeader}>
                  <h3 style={styles.cardTitle}>Activity Logs & Cloud Relay</h3>
                  <button onClick={() => setLogs([])} style={styles.clearLogsBtn}>Clear Logs</button>
                </div>
                <div style={styles.logsConsole}>
                  {logs.map((log, i) => (
                    <div key={i} style={styles.logRow}>
                      <span style={styles.logTime}>[{log.time}]</span>
                      <span style={styles.logText}>{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: HOME (Safe Navigation) */}
        {activeTab === 'home' && (
          <div className="animate-slideup" style={styles.tabContainer}>
            <div className="glass-container" style={styles.mapCardContainer}>
              <div style={styles.mapHeader}>
                <div>
                  <h3 style={styles.cardTitle}>HOME: Safe Corridor Navigation</h3>
                  <p style={styles.cardDesc}>
                    Google Maps API & Leaflet routing dashboard prioritizes street lighting levels, police booths, and CCTV surveillance networks over short distance routes.
                  </p>
                </div>

                <div style={styles.mapControls}>
                  <button 
                    onClick={startNavigationSimulation} 
                    disabled={isSimulating}
                    className="btn-neon-purple"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Navigation size={16} />
                    <span>Simulate Route</span>
                  </button>

                  <button 
                    onClick={simulatePathDeviation} 
                    disabled={!isSimulating && !deviationAlert}
                    className="btn-neon-danger"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <AlertTriangle size={16} />
                    <span>Simulate Deviation</span>
                  </button>
                </div>
              </div>

              {deviationAlert && (
                <div style={styles.mapAlertBanner} className="danger-pulse">
                  <AlertCircle size={20} />
                  <span><b>PATH DEVIATION DETECTED!</b> Family informed. Triggering SOS.</span>
                  <button onClick={() => setDeviationAlert(false)} style={styles.closeAlertBtn}>Dismiss</button>
                </div>
              )}

              {/* Leaflet map node */}
              <div style={styles.mapWrapperBox}>
                <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
              </div>

              {/* Map Legend */}
              <div style={styles.mapLegend}>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendLine, backgroundColor: '#06b6d4' }}></span>
                  <span>Safe Corridor (Safety Rating &gt;90%)</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendLine, backgroundColor: '#a855f7' }}></span>
                  <span>Armed Corridor (Safety Rating 80-90%)</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#06b6d4', boxShadow: '0 0 6px #06b6d4' }}></span>
                  <span>CCTV Camera</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#a855f7', boxShadow: '0 0 6px #a855f7' }}></span>
                  <span>Police Outpost</span>
                </div>
                <div style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#eab308', boxShadow: '0 0 6px #eab308' }}></span>
                  <span>Smart Streetlight</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: HEALTH (Medical Shield Card) */}
        {activeTab === 'health' && (
          <div className="animate-slideup" style={styles.tabContainer}>
            <div style={styles.gridTwoColumns}>
              
              {/* Encrypted Med-Card Form */}
              <div className="glass-container" style={styles.cardHealth}>
                <h3 style={styles.cardTitle}>HEALTH: Secure Emergency Med-Card</h3>
                <p style={styles.cardDesc}>
                  Stores critical health markers for responders. Data can be encrypted locally inside your device using AES-256 standards with a secure PIN wrapper.
                </p>

                {!isCardEncrypted ? (
                  // Edit raw med card
                  <form onSubmit={handleSaveRawCard} style={styles.medForm}>
                    <div style={styles.formGrid}>
                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Full Name</label>
                        <input 
                          type="text" 
                          className="glass-input" 
                          value={cardForm.name} 
                          onChange={e => setCardForm({...cardForm, name: e.target.value})}
                          placeholder="Jane Doe"
                          required
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Blood Group</label>
                        <select 
                          className="glass-input"
                          value={cardForm.bloodGroup}
                          onChange={e => setCardForm({...cardForm, bloodGroup: e.target.value})}
                          style={{ appearance: 'none', background: '#0a0c16', color: 'white' }}
                        >
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </div>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Allergies</label>
                      <input 
                        type="text" 
                        className="glass-input" 
                        value={cardForm.allergies} 
                        onChange={e => setCardForm({...cardForm, allergies: e.target.value})}
                        placeholder="Penicillin, Peanuts, etc."
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Chronic Illnesses / Conditions</label>
                      <input 
                        type="text" 
                        className="glass-input" 
                        value={cardForm.illnesses} 
                        onChange={e => setCardForm({...cardForm, illnesses: e.target.value})}
                        placeholder="Asthma, Diabetes, etc."
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Emergency Medications</label>
                      <input 
                        type="text" 
                        className="glass-input" 
                        value={cardForm.medications} 
                        onChange={e => setCardForm({...cardForm, medications: e.target.value})}
                        placeholder="Inhaler, Epipen, etc."
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Primary Doctor Contact</label>
                      <input 
                        type="text" 
                        className="glass-input" 
                        value={cardForm.doctor} 
                        onChange={e => setCardForm({...cardForm, doctor: e.target.value})}
                        placeholder="Dr. Smith (+919000000000)"
                      />
                    </div>

                    <div style={styles.actionButtonsRow}>
                      <button type="submit" className="btn-neon-cyan">Save Profile</button>
                      
                      {isMedCardLoaded && (
                        <button type="button" onClick={handleClearMedCard} style={styles.btnDangerOutlined}>
                          Wipe Card
                        </button>
                      )}
                    </div>
                  </form>
                ) : (
                  // Decrypted view interface
                  <div style={styles.decryptedViewContainer}>
                    {decryptedForm ? (
                      <div style={styles.cardDetailsBox}>
                        <div style={styles.badgeUnlocked}>
                          <Unlock size={14} />
                          <span>Decrypted Access</span>
                        </div>
                        <div style={styles.detailsGrid}>
                          <div style={styles.detailsRow}>
                            <span style={styles.detailsLabel}>Name:</span>
                            <span style={styles.detailsVal}>{decryptedForm.name}</span>
                          </div>
                          <div style={styles.detailsRow}>
                            <span style={styles.detailsLabel}>Blood Group:</span>
                            <span style={{...styles.detailsVal, color: '#f43f5e', fontWeight: 'bold'}}>{decryptedForm.bloodGroup}</span>
                          </div>
                          <div style={styles.detailsRow}>
                            <span style={styles.detailsLabel}>Allergies:</span>
                            <span style={styles.detailsVal}>{decryptedForm.allergies || 'None reported'}</span>
                          </div>
                          <div style={styles.detailsRow}>
                            <span style={styles.detailsLabel}>Conditions:</span>
                            <span style={styles.detailsVal}>{decryptedForm.illnesses || 'None'}</span>
                          </div>
                          <div style={styles.detailsRow}>
                            <span style={styles.detailsLabel}>Medications:</span>
                            <span style={styles.detailsVal}>{decryptedForm.medications || 'None'}</span>
                          </div>
                          <div style={styles.detailsRow}>
                            <span style={styles.detailsLabel}>Primary Doctor:</span>
                            <span style={styles.detailsVal}>{decryptedForm.doctor || 'N/A'}</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => setDecryptedForm(null)}
                          style={{ ...styles.btnGlass, width: '100%', marginTop: '20px' }}
                        >
                          Lock Card Display
                        </button>
                      </div>
                    ) : (
                      <div style={styles.lockedStateBox}>
                        <Lock size={44} color="#a855f7" style={{ marginBottom: '16px' }} />
                        <h4 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Emergency Medical Card Encrypted</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', maxWidth: '300px', marginBottom: '24px' }}>
                          Unlock medical record to read or write secure details.
                        </p>

                        <div style={styles.pinWrapper}>
                          <input 
                            type="password" 
                            className="glass-input" 
                            placeholder="Enter 4-digit PIN"
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.2rem', maxWidth: '200px' }}
                          />
                          {pinError && <div style={{ color: '#f43f5e', fontSize: '0.8rem', marginTop: '8px' }}>{pinError}</div>}

                          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', width: '100%', justifyContent: 'center' }}>
                            <button onClick={handleDecryptMedCard} className="btn-neon-purple">
                              Unlock Card
                            </button>
                            <button onClick={handleClearMedCard} style={styles.btnDangerOutlined}>
                              Wipe Data
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Secure with PIN module wrapper */}
                {isMedCardLoaded && !isCardEncrypted && (
                  <div style={styles.encryptBlock} className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Lock size={18} color="#06b6d4" />
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Encrypt Med-Card locally</h4>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
                      Specify a numeric lock PIN. Once encrypted, your profile data cannot be read without this key.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="password" 
                        className="glass-input" 
                        placeholder="PIN key" 
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        style={{ maxWidth: '120px', textAlign: 'center' }}
                      />
                      <button onClick={handleEncryptMedCard} className="btn-neon-cyan" style={{ padding: '10px 20px' }}>
                        Encrypt Card
                      </button>
                    </div>
                    {pinError && <div style={{ color: '#f43f5e', fontSize: '0.8rem', marginTop: '8px' }}>{pinError}</div>}
                  </div>
                )}

              </div>

              {/* Incident Counseling support Hotlines */}
              <div className="glass-container" style={styles.cardHealth}>
                <h3 style={styles.cardTitle}>Post-Incident Counseling Hotlines</h3>
                <p style={styles.cardDesc}>
                  Access certified post-incident emotional support, legal guidance clinics, and trauma recovery hotlines.
                </p>

                <div style={styles.hotlinesList}>
                  
                  <div style={styles.hotlineItem} className="glass-card">
                    <div style={styles.hotlineHeader}>
                      <div style={styles.hotlineTitleBox}>
                        <span style={styles.hotlineTag}>Trauma Recovery</span>
                        <h4 style={styles.hotlineName}>Vandrevala Foundation</h4>
                      </div>
                      <a href="tel:9999666555" style={styles.phoneCircle}>
                        <Phone size={18} />
                      </a>
                    </div>
                    <p style={styles.hotlineDetails}>
                      24/7 mental wellness and post-assault diagnostic counseling.
                    </p>
                    <div style={styles.hotlineNum}>📞 +91 9999 666 555</div>
                  </div>

                  <div style={styles.hotlineItem} className="glass-card">
                    <div style={styles.hotlineHeader}>
                      <div style={styles.hotlineTitleBox}>
                        <span style={styles.hotlineTag}>Legal & Support</span>
                        <h4 style={styles.hotlineName}>NCW Safety Helpline</h4>
                      </div>
                      <a href="tel:7827170170" style={{...styles.phoneCircle, backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#a855f7'}}>
                        <Phone size={18} />
                      </a>
                    </div>
                    <p style={styles.hotlineDetails}>
                      National Commission for Women legal guidance and safe shelter dispatches.
                    </p>
                    <div style={styles.hotlineNum}>📞 +91 7827 170 170</div>
                  </div>

                  <div style={styles.hotlineItem} className="glass-card">
                    <div style={styles.hotlineHeader}>
                      <div style={styles.hotlineTitleBox}>
                        <span style={styles.hotlineTag}>Immediate Rescue</span>
                        <h4 style={styles.hotlineName}>Women Helpline (Sarkari)</h4>
                      </div>
                      <a href="tel:1091" style={{...styles.phoneCircle, backgroundColor: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e'}}>
                        <Phone size={18} />
                      </a>
                    </div>
                    <p style={styles.hotlineDetails}>
                      Fast police emergency support dispatch for women in danger.
                    </p>
                    <div style={styles.hotlineNum}>📞 1091 (Toll Free)</div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 4: SOS CONTACTS EDIT */}
        {activeTab === 'contacts' && (
          <div className="animate-slideup" style={styles.tabContainer}>
            <div style={styles.gridTwoColumns}>
              
              {/* Form to add contacts */}
              <div className="glass-container" style={styles.cardHealth}>
                <h3 style={styles.cardTitle}>Add Trusted Contact</h3>
                <p style={styles.cardDesc}>
                  Include coordinates of trusted guardians, colleagues, or local neighborhood nodes that should receive the panic SMS immediately.
                </p>

                <form onSubmit={handleAddContact} style={styles.medForm}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Contact Name</label>
                    <input 
                      type="text" 
                      className="glass-input" 
                      placeholder="e.g. Brother, Husband"
                      value={newContactName}
                      onChange={e => setNewContactName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Phone Number</label>
                    <input 
                      type="tel" 
                      className="glass-input" 
                      placeholder="e.g. +91 99999 99999"
                      value={newContactPhone}
                      onChange={e => setNewContactPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Relationship Group</label>
                    <select 
                      className="glass-input"
                      value={newContactRel}
                      onChange={e => setNewContactRel(e.target.value)}
                      style={{ appearance: 'none', background: '#0a0c16', color: 'white' }}
                    >
                      <option value="Family">Family</option>
                      <option value="Friend">Friend</option>
                      <option value="Neighbor">Neighbor</option>
                      <option value="Medical Responder">Medical Responder</option>
                      <option value="Official">Official Authority</option>
                    </select>
                  </div>

                  <button type="submit" className="btn-neon-cyan" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
                    <Plus size={18} />
                    <span>Save Emergency Contact</span>
                  </button>
                </form>
              </div>

              {/* Contacts Grid list */}
              <div className="glass-container" style={styles.cardHealth}>
                <h3 style={styles.cardTitle}>Trusted Safety Circle ({contacts.length})</h3>
                <p style={styles.cardDesc}>
                  These lines will receive live tracking coordinates automatically during a HELP event.
                </p>

                <div style={styles.contactsGrid}>
                  {contacts.length === 0 ? (
                    <div style={styles.emptyContacts}>
                      <span>No trusted contacts configured. Please add contacts to secure SMS broadcast.</span>
                    </div>
                  ) : (
                    contacts.map((contact) => (
                      <div key={contact.id} className="glass-card" style={styles.contactCard}>
                        <div style={styles.contactLeft}>
                          <div style={styles.contactAvatar}>
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 style={styles.contactName}>{contact.name}</h4>
                            <span style={styles.contactPhone}>{contact.phone}</span>
                            <span style={styles.relationshipBadge}>{contact.relationship}</span>
                          </div>
                        </div>
                        
                        {/* Protect index 0 (112 National Police) from deletion */}
                        {contact.phone !== '112' ? (
                          <button 
                            onClick={() => handleDeleteContact(contact.id, contact.name)}
                            style={styles.deleteContactBtn}
                            title="Delete Contact"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <span style={styles.officialContactLabel}>Protected Node</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 5: VOLUNTEERS */}
        {activeTab === 'volunteers' && (
          <div className="animate-slideup" style={styles.tabContainer}>
            <div style={styles.gridTwoColumns}>
              
              {/* Volunteer Registration & controls */}
              <div className="glass-container" style={styles.cardHealth}>
                <h3 style={styles.cardTitle}>🤝 Guardian Volunteer Circle</h3>
                <p style={styles.cardDesc}>
                  Register as a local volunteer to support women in distress around you, or request a walk-along escort if walking alone late at night.
                </p>

                {/* Volunteer Status Toggle */}
                <div style={{
                  ...styles.emergencyStatusPanel,
                  borderColor: isRegisteredVolunteer ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.05)'
                }}>
                  <div style={styles.statusLabel}>Your Volunteer Status:</div>
                  <div style={{
                    ...styles.statusValue,
                    color: isRegisteredVolunteer ? '#22c55e' : '#64748b',
                    fontSize: '1.1rem'
                  }}>
                    {isRegisteredVolunteer ? '🟢 ACTIVE LOCAL GUARDIAN' : '⚪ NOT REGISTERED (Receiver Only)'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button 
                    onClick={() => {
                      setIsRegisteredVolunteer(!isRegisteredVolunteer);
                      addLog(!isRegisteredVolunteer 
                        ? "🤝 You are now registered as an Active Safety Volunteer! Thank you."
                        : "🤝 You opted out of the Volunteer responder program." 
                      );
                    }}
                    className={isRegisteredVolunteer ? "btn-neon-danger" : "btn-neon-cyan"}
                    style={{ flex: 1 }}
                  >
                    {isRegisteredVolunteer ? "De-register as Volunteer" : "Register as Safety Volunteer"}
                  </button>
                </div>

                {/* Real-time Tracking Controls */}
                <div style={styles.encryptBlock} className="glass-card" style={{ marginTop: '20px', padding: '16px', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px', color: '#06b6d4' }}>📡 Real-Time GPS Tracking</h4>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.4 }}>
                    Turn on live satellite tracking. If you are demoing on a computer, use "Simulate Walking" to see your coordinates pan and trace location in real-time.
                  </p>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={startRealTimeTracking} 
                      className={watchId ? "btn-neon-purple" : "btn-neon-cyan"}
                      style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
                    >
                      {watchId ? "Stop Live GPS Watch" : "Start Live GPS Watch"}
                    </button>
                    <button 
                      onClick={startWalkingSimulation} 
                      className={isWalking ? "btn-neon-danger" : "btn-neon-purple"}
                      style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
                    >
                      {isWalking ? "Stop Walking Simulation" : "Simulate Walking"}
                    </button>
                  </div>

                  <div style={{ ...styles.gpsCoords, marginTop: '12px', fontSize: '0.85rem' }}>
                    {gpsLocation ? (
                      <span>Current GPS: Lat {gpsLocation.lat.toFixed(6)} | Lng {gpsLocation.lng.toFixed(6)}</span>
                    ) : (
                      <span>GPS State: Idle (Press start or walk to lock location)</span>
                    )}
                  </div>
                </div>

                {/* Request Escort controls */}
                <div style={styles.encryptBlock} className="glass-card" style={{ marginTop: '20px', border: '1px solid rgba(168,85,247,0.3)', padding: '16px', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px', color: '#a855f7' }}>🛡️ Request Escort Dispatch</h4>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.4 }}>
                    Sends a beacon to nearest verified guardians. They will navigate to your live coordinate in real-time.
                  </p>

                  {volunteerRequestStatus === 'idle' && (
                    <button onClick={requestVolunteerEscort} className="btn-neon-purple" style={{ width: '100%', padding: '12px', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}>
                      Request Volunteer Escort Walk
                    </button>
                  )}
                  {volunteerRequestStatus === 'searching' && (
                    <div style={{ color: '#06b6d4', fontWeight: 'bold', animation: 'pulse 1.5s infinite', textAlign: 'center', padding: '10px' }}>
                      🔍 Contacting nearest safety nodes...
                    </div>
                  )}
                  {volunteerRequestStatus === 'connected' && escortVolunteer && (
                    <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ color: '#22c55e', fontWeight: 'bold' }}>🏃 Volunteer Dispatch En-Route!</div>
                      <div style={{ color: '#fff', fontSize: '0.88rem', marginTop: '6px', lineHeight: 1.4 }}>
                        <b>{escortVolunteer.name}</b> is heading to your coordinates.<br/>
                        Contact: <b>{escortVolunteer.phone}</b><br/>
                        Current distance: <span style={{ color: '#06b6d4', fontWeight: 'bold' }}>{escortVolunteer.distance}m</span>
                      </div>
                    </div>
                  )}
                  {volunteerRequestStatus === 'arrived' && escortVolunteer && (
                    <div style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid #06b6d4', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ color: '#06b6d4', fontWeight: 'bold' }}>💚 Guardian Arrived!</div>
                      <div style={{ color: '#fff', fontSize: '0.88rem', marginTop: '6px', lineHeight: 1.4 }}>
                        <b>{escortVolunteer.name}</b> has arrived safely at your location.
                      </div>
                      <button 
                        onClick={() => {
                          setVolunteerRequestStatus('idle');
                          setEscortVolunteer(null);
                        }} 
                        className="btn-neon-cyan" 
                        style={{ marginTop: '10px', padding: '6px 12px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold' }}
                      >
                        Finish Escort
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* Live Map of volunteers */}
              <div className="glass-container" style={styles.cardHealth}>
                <h3 style={styles.cardTitle}>Live Rescue Tracking Map</h3>
                <p style={styles.cardDesc}>
                  Real-time visualization of your position (Blue node) and active emergency volunteers (Green nodes) walking around you.
                </p>

                {/* Leaflet map node for volunteers */}
                <div style={styles.mapWrapperBox}>
                  <div ref={volunteerMapRef} style={{ width: '100%', height: '100%' }}></div>
                </div>

                {/* Legend */}
                <div style={styles.mapLegend} style={{ marginTop: '12px', justifyContent: 'center' }}>
                  <div style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }}></span>
                    <span>You (Live GPS)</span>
                  </div>
                  <div style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }}></span>
                    <span>Active Volunteers</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// Styling Object
const styles = {
  appWrapper: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg-primary)',
    transition: 'background-color 0.4s ease',
  },
  sidebar: {
    width: '280px',
    padding: '30px 20px',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
    borderRadius: '0 24px 24px 0',
    borderLeft: 'none',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '35px',
    paddingLeft: '10px',
  },
  brandText: {
    fontSize: '1.4rem',
    fontWeight: '800',
    letterSpacing: '1.5px',
    background: 'linear-gradient(135deg, #06b6d4 0%, #a855f7 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    marginBottom: '30px',
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#a855f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '1.2rem',
    color: 'white',
    boxShadow: '0 0 10px rgba(168, 85, 247, 0.4)',
  },
  userName: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  userRole: {
    fontSize: '0.75rem',
    color: '#06b6d4',
    fontWeight: '500',
  },
  navMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flexGrow: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    borderRadius: '12px',
    color: '#94a3b8',
    cursor: 'pointer',
    fontFamily: 'var(--font-heading)',
    fontSize: '0.9rem',
    fontWeight: '600',
    textAlign: 'left',
    transition: 'var(--transition-smooth)',
  },
  navActive: {
    background: 'rgba(6, 182, 212, 0.15)',
    color: '#06b6d4',
    border: '1px solid rgba(6, 182, 212, 0.2)',
  },
  voiceIndicatorPanel: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '20px',
  },
  voiceIndicatorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    transition: 'var(--transition-smooth)',
  },
  signOutBtn: {
    background: 'none',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#64748b',
    padding: '10px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  mainContent: {
    flexGrow: 1,
    padding: '30px',
    overflowY: 'auto',
    height: '100vh',
  },
  tabContainer: {
    width: '100%',
    height: '100%',
  },
  gridTwoColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    width: '100%',
  },
  cardHelp: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardTitle: {
    fontSize: '1.4rem',
    fontWeight: '700',
    color: '#fff',
  },
  cardDesc: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    lineHeight: '1.5',
  },
  shieldPulseArea: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '30px 0',
  },
  sosButtonArmed: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    backgroundColor: '#0a0d1d',
    border: '4px solid #06b6d4',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)',
    transition: 'all 0.3s ease',
  },
  sosButtonActive: {
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    backgroundColor: '#f43f5e',
    border: '4px solid #fda4af',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'white',
    boxShadow: '0 0 30px rgba(244, 63, 94, 0.6)',
    transition: 'all 0.3s ease',
  },
  emergencyStatusPanel: {
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    textAlign: 'center',
  },
  statusLabel: {
    fontSize: '0.8rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '4px',
  },
  statusValue: {
    fontSize: '1.15rem',
    fontWeight: '700',
  },
  coordinateDisplay: {
    padding: '16px',
    background: 'rgba(10, 12, 22, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  gpsCoords: {
    fontSize: '0.95rem',
    fontFamily: 'monospace',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  cardLogs: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '480px',
  },
  logsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  clearLogsBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    transition: 'var(--transition-smooth)',
  },
  logsConsole: {
    flexGrow: 1,
    background: '#04060d',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    maxHeight: '400px',
  },
  logRow: {
    display: 'flex',
    gap: '10px',
    lineHeight: '1.4',
  },
  logTime: {
    color: '#64748b',
    flexShrink: 0,
  },
  logText: {
    color: '#cbd5e1',
  },
  mapCardContainer: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%',
  },
  mapHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  mapControls: {
    display: 'flex',
    gap: '12px',
  },
  mapAlertBanner: {
    background: 'rgba(244, 63, 94, 0.15)',
    border: '1px solid #f43f5e',
    borderRadius: '12px',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#f8fafc',
    fontSize: '0.9rem',
  },
  closeAlertBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#f8fafc',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  mapWrapperBox: {
    height: '520px',
    width: '100%',
    borderRadius: '16px',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  mapLegend: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    marginTop: '10px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
  legendLine: {
    width: '24px',
    height: '4px',
    borderRadius: '2px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  cardHealth: {
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  medForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 120px',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#94a3b8',
    paddingLeft: '4px',
  },
  actionButtonsRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '10px',
  },
  btnDangerOutlined: {
    background: 'none',
    border: '1px solid rgba(244, 63, 94, 0.4)',
    color: '#f43f5e',
    padding: '12px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-heading)',
    fontWeight: '600',
    transition: 'var(--transition-smooth)',
  },
  encryptBlock: {
    marginTop: '10px',
    border: '1px dashed rgba(6, 182, 212, 0.3)',
    background: 'rgba(6, 182, 212, 0.02)',
  },
  decryptedViewContainer: {
    padding: '16px 0',
  },
  cardDetailsBox: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
    padding: '24px',
    position: 'relative',
  },
  badgeUnlocked: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid #22c55e',
    color: '#22c55e',
    borderRadius: '20px',
    padding: '4px 10px',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  detailsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '20px',
  },
  detailsRow: {
    display: 'flex',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '8px',
  },
  detailsLabel: {
    width: '140px',
    color: '#64748b',
    fontWeight: '600',
    fontSize: '0.85rem',
  },
  detailsVal: {
    color: '#e2e8f0',
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  lockedStateBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px dashed rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
  },
  pinWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  hotlinesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  hotlineItem: {
    padding: '20px',
  },
  hotlineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  hotlineTitleBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  hotlineTag: {
    fontSize: '0.7rem',
    color: '#06b6d4',
    background: 'rgba(6, 182, 212, 0.1)',
    border: '1px solid rgba(6, 182, 212, 0.2)',
    padding: '2px 8px',
    borderRadius: '10px',
    width: 'fit-content',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  hotlineName: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'white',
  },
  phoneCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    color: '#06b6d4',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
  },
  hotlineDetails: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    lineHeight: '1.4',
    marginBottom: '10px',
  },
  hotlineNum: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  contactsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  emptyContacts: {
    padding: '30px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.85rem',
    border: '1px dashed rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
  },
  contactCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
  },
  contactLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  contactAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#06b6d4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
  },
  contactName: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#fff',
  },
  contactPhone: {
    display: 'block',
    fontSize: '0.8rem',
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: '2px',
  },
  relationshipBadge: {
    display: 'inline-block',
    fontSize: '0.65rem',
    color: '#a855f7',
    background: 'rgba(168, 85, 247, 0.1)',
    padding: '1px 6px',
    borderRadius: '6px',
    marginTop: '4px',
    fontWeight: 'bold',
  },
  deleteContactBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
  },
  officialContactLabel: {
    fontSize: '0.7rem',
    color: '#06b6d4',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  audioBarsWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: '4px',
    padding: '12px',
    background: 'rgba(6, 182, 212, 0.05)',
    border: '1px solid rgba(6, 182, 212, 0.1)',
    borderRadius: '12px',
    minHeight: '60px',
  },
  audioBar: {
    width: '6px',
    borderRadius: '3px',
    backgroundColor: '#06b6d4',
    boxShadow: '0 0 6px rgba(6, 182, 212, 0.6)',
    animation: 'hmmBarPulse 0.6s ease-in-out infinite alternate',
  },
  recordingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: 'rgba(244, 63, 94, 0.1)',
    border: '1px solid rgba(244, 63, 94, 0.3)',
    borderRadius: '12px',
    fontSize: '0.88rem',
    color: '#f8fafc',
  }
};
