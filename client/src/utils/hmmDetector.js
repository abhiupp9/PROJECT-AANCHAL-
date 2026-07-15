// hmmDetector.js
// Muffled Panic Vocal Analyzer
// Uses Web Audio AnalyserNode to detect sustained low-frequency nasal humming
// (the "Hmm-Hmm" sound made when a mouth is covered/muffled)

let analyserNode = null;
let audioStream = null;
let audioContext = null;
let mediaRecorder = null;
let recordedChunks = [];
let detectionInterval = null;
let isDetecting = false;
let isRecording = false;
let consecutiveHumFrames = 0;

// Tuning parameters
const HUM_MIN_FREQ = 80;   // Hz — lower bound of nasal hum (m/n sounds)
const HUM_MAX_FREQ = 350;  // Hz — upper bound
const HUM_AMPLITUDE_THRESHOLD = 60; // dB-equivalent energy threshold
const FRAMES_TO_TRIGGER = 30;  // ~1.5 seconds of sustained hum to trigger (at 50ms interval)
const ANALYSIS_INTERVAL_MS = 50;

export function startHmmDetection({ onTrigger, onStatusChange, username, lat, lng }) {
  if (isDetecting) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (onStatusChange) onStatusChange('unsupported');
    console.warn("⚠️ getUserMedia is not supported in this browser.");
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
      audioStream = stream;
      
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();

      const source = audioContext.createMediaStreamSource(stream);
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;  // Good resolution for voice frequency band
      analyserNode.smoothingTimeConstant = 0.8;
      source.connect(analyserNode);

      isDetecting = true;
      consecutiveHumFrames = 0;
      if (onStatusChange) onStatusChange('detecting');
      console.log("👂 AANCHAL Muffled Vocal Sensor ARMED. Listening for panic Hmm-Hmm patterns...");

      detectionInterval = setInterval(() => {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        const sampleRate = audioContext.sampleRate;
        const binHz = sampleRate / analyserNode.fftSize;

        const minBin = Math.floor(HUM_MIN_FREQ / binHz);
        const maxBin = Math.ceil(HUM_MAX_FREQ / binHz);

        // Sum energy in the hum frequency band
        let humEnergy = 0;
        for (let i = minBin; i <= maxBin && i < bufferLength; i++) {
          humEnergy += dataArray[i];
        }
        const avgHumEnergy = humEnergy / (maxBin - minBin + 1);

        // Also check total audio energy to distinguish voiced from noise
        let totalEnergy = 0;
        for (let i = 0; i < bufferLength; i++) totalEnergy += dataArray[i];
        const avgTotalEnergy = totalEnergy / bufferLength;

        // Hum ratio: hum bands should dominate the frequency spectrum
        const humRatio = avgTotalEnergy > 5 ? avgHumEnergy / avgTotalEnergy : 0;

        if (avgHumEnergy > HUM_AMPLITUDE_THRESHOLD && humRatio > 0.55) {
          consecutiveHumFrames++;
          console.log(`🔉 Hmm-detected: energy=${avgHumEnergy.toFixed(1)} ratio=${humRatio.toFixed(2)} frames=${consecutiveHumFrames}`);

          if (consecutiveHumFrames >= FRAMES_TO_TRIGGER && !isRecording) {
            console.log("🚨 MUFFLED PANIC VOCAL PATTERN TRIGGERED! Starting emergency recording...");
            if (onStatusChange) onStatusChange('triggered');
            startEmergencyRecording({ stream, onTrigger, username, lat, lng });
          }
        } else {
          // Reset if silent
          if (consecutiveHumFrames > 0) {
            consecutiveHumFrames = Math.max(0, consecutiveHumFrames - 3); // Decay slowly
          }
        }
      }, ANALYSIS_INTERVAL_MS);
    })
    .catch(err => {
      console.error("❌ Microphone access denied for Hmm detector:", err);
      if (onStatusChange) onStatusChange('error');
    });
}

function startEmergencyRecording({ stream, onTrigger, username, lat, lng }) {
  if (isRecording) return;
  isRecording = true;
  recordedChunks = [];

  const options = { mimeType: 'audio/webm;codecs=opus' };
  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (e) {
    // Fallback for browsers not supporting opus
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    recordedChunks = [];
    isRecording = false;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Audio = reader.result;
      
      // Get current coordinates (or use passed-in values)
      let currentLat = lat || 28.6304;
      let currentLng = lng || 77.2177;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            currentLat = pos.coords.latitude;
            currentLng = pos.coords.longitude;
            uploadRecording({ base64Audio, username, lat: currentLat, lng: currentLng, onTrigger });
          },
          () => {
            // Use fallback coordinates
            uploadRecording({ base64Audio, username, lat: currentLat, lng: currentLng, onTrigger });
          },
          { enableHighAccuracy: true, timeout: 3000 }
        );
      } else {
        uploadRecording({ base64Audio, username, lat: currentLat, lng: currentLng, onTrigger });
      }
    };

    reader.readAsDataURL(audioBlob);
  };

  // Record for 8 seconds then stop and upload
  mediaRecorder.start(1000);  // collect data every 1s
  console.log("🔴 RECORDING STARTED — Capturing 8 seconds of audio evidence...");

  setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      console.log("⏹️ RECORDING COMPLETE — Uploading to secure server...");
    }
  }, 8000);

  // Fire callback immediately to inform UI
  if (onTrigger) onTrigger({ lat, lng });
}

async function uploadRecording({ base64Audio, username, lat, lng, onTrigger }) {
  try {
    const res = await fetch('/api/upload-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData: base64Audio,
        username: username || 'Unknown',
        lat,
        lng,
        timestamp: new Date().toISOString()
      })
    });
    const data = await res.json();
    console.log("✅ Audio stream uploaded successfully. Stream ID:", data.streamId);
  } catch (err) {
    console.error("⚠️ Failed to upload recording to server:", err);
  }
}

export function stopHmmDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (audioStream) {
    audioStream.getTracks().forEach(t => t.stop());
    audioStream = null;
  }
  isDetecting = false;
  isRecording = false;
  consecutiveHumFrames = 0;
  console.log("👂 Muffled vocal sensor DISARMED.");
}

export function isHmmDetectionActive() {
  return isDetecting;
}
