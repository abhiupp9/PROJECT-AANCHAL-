// voiceListener.js
// Native SpeechRecognition Background Voice Activation Trigger

let recognitionInstance = null;
let isListeningActive = false;

export function startVoiceRecognition(onTrigger, onStatusChange) {
  if (isListeningActive) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn("⚠️ Web Speech API (SpeechRecognition) is not supported in this browser.");
    if (onStatusChange) onStatusChange('unsupported');
    return;
  }

  try {
    recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onstart = () => {
      isListeningActive = true;
      console.log("🎙️ AANCHAL voice trigger active. Listening in background for: 'HELP! HELP! HELP!'");
      if (onStatusChange) onStatusChange('listening');
    };

    recognitionInstance.onerror = (event) => {
      // Ignore 'no-speech' errors which are expected in quiet environments to prevent service crashes
      if (event.error !== 'no-speech') {
        console.error("🎙️ Voice Recognition error:", event.error);
        if (onStatusChange) onStatusChange('error');
      }
    };

    recognitionInstance.onend = () => {
      isListeningActive = false;
      // Auto-restart if we want background tracking active
      if (recognitionInstance) {
        try {
          recognitionInstance.start();
        } catch (e) {
          console.error("🎙️ Error auto-restarting voice recognition:", e);
          if (onStatusChange) onStatusChange('stopped');
        }
      } else {
        if (onStatusChange) onStatusChange('stopped');
      }
    };

    recognitionInstance.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptSegment;
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      const combinedText = (finalTranscript + ' ' + interimTranscript).toLowerCase().trim();
      
      // Clean up punctuation to match spoken words reliably
      const cleanText = combinedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");

      // Check if user is repeating help multiple times (e.g. "help help help")
      if (
        cleanText.includes("help help help") ||
        cleanText.includes("help! help! help!") ||
        (cleanText.match(/help/g) || []).length >= 3
      ) {
        console.log(`🚨 TRIGGER PHRASE DETECTED: "${combinedText}"`);
        
        // Vibrate if mobile device support exists
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100, 50, 300]);
        }

        onTrigger();
      }
    };

    recognitionInstance.start();
  } catch (error) {
    console.error("🎙️ Failed to initialize voice recognition:", error);
    if (onStatusChange) onStatusChange('error');
  }
}

export function stopVoiceRecognition() {
  if (recognitionInstance) {
    const tempInstance = recognitionInstance;
    recognitionInstance = null; // Unbind so onend callback doesn't auto-restart
    try {
      tempInstance.stop();
    } catch (e) {
      console.error(e);
    }
  }
  isListeningActive = false;
}
