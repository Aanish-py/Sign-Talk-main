/**
 * Two-Way Audio Translation Engine
 * 
 * 1. Text-to-Speech (TTS): Speaks recognized sign names aloud for hearing participants.
 * 2. Speech-to-Text (STT): Transcribes spoken speech in real-time to display live captions for Deaf participants.
 */

// ==========================================
// 1. Text-to-Speech (TTS) Service
// ==========================================
class TTSService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.selectedVoice = null;
    this.isMuted = false;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;

    if (this.synth) {
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();

    // Prefer English (India) or standard clear English voices
    const preferredVoice =
      this.voices.find((v) => v.lang === 'en-IN') ||
      this.voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural'))) ||
      this.voices.find((v) => v.lang.startsWith('en')) ||
      this.voices[0];

    this.selectedVoice = preferredVoice || null;
  }

  /**
   * Speaks a word or sentence aloud.
   * 
   * @param {string} text 
   * @param {Object} options 
   */
  speak(text, options = {}) {
    if (!this.synth || this.isMuted || !text) return;

    try {
      // Cancel ongoing utterance to prevent audio queuing overlap
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = options.rate || this.rate;
      utterance.pitch = options.pitch || this.pitch;
      utterance.volume = options.volume || this.volume;

      if (options.onStart) utterance.onstart = options.onStart;
      if (options.onEnd) utterance.onend = options.onEnd;
      if (options.onError) utterance.onerror = options.onError;

      this.synth.speak(utterance);
    } catch (err) {
      console.warn('[TTS] Speech synthesis error:', err);
    }
  }

  cancel() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted) this.cancel();
  }

  setRate(rate) {
    this.rate = rate;
  }

  setVoice(voiceURI) {
    const found = this.voices.find((v) => v.voiceURI === voiceURI);
    if (found) this.selectedVoice = found;
  }

  isSupported() {
    return !!this.synth;
  }
}

export const ttsService = new TTSService();

// ==========================================
// 2. Speech-to-Text (STT) Service
// ==========================================
class STTService {
  constructor() {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    this.RecognitionClass = SpeechRecognition;
    this.recognition = null;
    this.isListening = false;
    this.shouldKeepListening = false;
    this.callbacks = {};
  }

  isSupported() {
    return !!this.RecognitionClass;
  }

  /**
   * Starts real-time continuous speech transcription.
   * 
   * @param {Object} callbacks { onInterim: (text) => void, onFinal: (text) => void, onError: (err) => void, onStatusChange: (bool) => void }
   * @param {string} lang e.g. 'en-US' or 'en-IN'
   */
  start(callbacks = {}, lang = 'en-US') {
    if (!this.isSupported()) {
      if (callbacks.onError) {
        callbacks.onError(new Error('Web Speech API is not supported in this browser. Please use Chrome or Edge.'));
      }
      return false;
    }

    this.callbacks = callbacks;
    this.shouldKeepListening = true;

    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch (e) {}
      }

      const recognition = new this.RecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        this.isListening = true;
        if (this.callbacks.onStatusChange) this.callbacks.onStatusChange(true);
      };

      recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript + ' ';
          } else {
            interimText += transcript;
          }
        }

        if (finalText && this.callbacks.onFinal) {
          this.callbacks.onFinal(finalText.trim());
        }
        if (interimText && this.callbacks.onInterim) {
          this.callbacks.onInterim(interimText.trim());
        }
      };

      recognition.onerror = (event) => {
        console.warn('[STT] Speech recognition error event:', event.error);
        if (this.callbacks.onError && event.error !== 'no-speech') {
          this.callbacks.onError(event.error);
        }
      };

      recognition.onend = () => {
        this.isListening = false;
        if (this.callbacks.onStatusChange) this.callbacks.onStatusChange(false);

        // Auto-restart if continuous listening is requested
        if (this.shouldKeepListening) {
          try {
            recognition.start();
          } catch (e) {
            // Already starting or blocked
          }
        }
      };

      recognition.start();
      this.recognition = recognition;
      return true;
    } catch (err) {
      console.error('[STT] Failed to start speech recognition:', err);
      if (this.callbacks.onError) this.callbacks.onError(err);
      return false;
    }
  }

  /**
   * Stops transcription listening.
   */
  stop() {
    this.shouldKeepListening = false;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.recognition = null;
    }
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(false);
    }
  }
}

export const sttService = new STTService();
