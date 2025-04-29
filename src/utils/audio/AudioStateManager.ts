
export class AudioStateManager {
  private silenceTimeout: NodeJS.Timeout | null = null;
  private autoStopTimeout: NodeJS.Timeout | null = null;
  private isProcessingResponse: boolean = false;
  private audioBufferCreated: boolean = false;
  private sessionConfirmed: boolean = false;
  private _isListening: boolean = false;
  private _isSpeaking: boolean = false;

  constructor(private readonly onSilence: () => void = () => {}) {}

  handleSilence() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }

    this.silenceTimeout = setTimeout(() => {
      console.log('Extended silence detected, stopping recording');
      this.onSilence();
    }, 5000);
  }

  resetSilenceTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  clearTimeouts() {
    this.resetSilenceTimeout();
    if (this.autoStopTimeout) {
      clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }
  }

  setProcessingResponse(value: boolean) {
    this.isProcessingResponse = value;
  }

  isProcessing(): boolean {
    return this.isProcessingResponse;
  }

  setAudioBufferCreated(value: boolean) {
    this.audioBufferCreated = value;
  }

  isAudioBufferCreated(): boolean {
    return this.audioBufferCreated;
  }

  setSessionConfirmed(value: boolean) {
    this.sessionConfirmed = value;
  }

  isSessionConfirmed(): boolean {
    return this.sessionConfirmed;
  }
  
  setIsListening(value: boolean) {
    this._isListening = value;
  }
  
  isListening(): boolean {
    return this._isListening;
  }
  
  setIsSpeaking(value: boolean) {
    this._isSpeaking = value;
  }
  
  isSpeaking(): boolean {
    return this._isSpeaking;
  }

  setupAutoStop(callback: () => void) {
    this.autoStopTimeout = setTimeout(() => {
      callback();
    }, 30000);
  }

  reset() {
    this.clearTimeouts();
    this.isProcessingResponse = false;
    this.audioBufferCreated = false;
    this.sessionConfirmed = false;
    this._isListening = false;
    this._isSpeaking = false;
  }
}
