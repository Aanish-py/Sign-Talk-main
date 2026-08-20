/**
 * GestureSmoother (Anti-Flicker Temporal Pipeline)
 * 
 * Provides rock-solid gesture recognition stability by:
 * 1. Sliding Window Majority Voting (last N frames)
 * 2. Temporal Confidence Thresholding
 * 3. Smart Debounce & Cooldown (prevents repeated TTS triggers while holding pose)
 * 4. Automatic Reset upon hand drop
 */

export class GestureSmoother {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 10;
    this.minAgreementRatio = options.minAgreementRatio || 0.70; // 70% of window must agree
    this.minConfidence = options.minConfidence || 0.75;          // Average confidence >= 75%
    this.cooldownMs = options.cooldownMs || 1800;               // 1.8s debounce for same sign
    
    this.buffer = [];
    this.lastConfirmedSign = null;
    this.lastConfirmedTime = 0;
    this.noHandCount = 0;
  }

  /**
   * Processes a raw frame prediction.
   * 
   * @param {{signId: number, name: string, displayText: string, ttsText: string, confidence: number} | null} rawPrediction 
   * @param {Function} onConfirmed Optional callback triggered when a sign is confirmed
   * @returns {{
   *   currentSign: Object | null,
   *   stableSign: Object | null,
   *   stabilityScore: number,
   *   confidence: number,
   *   isConfirmed: boolean,
   *   inCooldown: boolean
   * }}
   */
  process(rawPrediction, onConfirmed = null) {
    const now = performance.now();

    // If no hand or null prediction
    if (!rawPrediction || rawPrediction.confidence < 0.4) {
      this.noHandCount++;
      if (this.noHandCount > 4) {
        this.buffer = [];
        this.lastConfirmedSign = null; // Reset debounce when hand is dropped
      }
      return {
        currentSign: null,
        stableSign: null,
        stabilityScore: 0,
        confidence: 0,
        isConfirmed: false,
        inCooldown: false
      };
    }

    this.noHandCount = 0;

    // Add to sliding window
    this.buffer.push(rawPrediction);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    // Tally sign counts in window
    const counts = {};
    const confidences = {};

    this.buffer.forEach((pred) => {
      counts[pred.signId] = (counts[pred.signId] || 0) + 1;
      if (!confidences[pred.signId]) confidences[pred.signId] = [];
      confidences[pred.signId].push(pred.confidence);
    });

    // Find majority mode
    let maxCount = 0;
    let modeSignId = null;

    Object.keys(counts).forEach((signIdStr) => {
      const sId = parseInt(signIdStr, 10);
      if (counts[sId] > maxCount) {
        maxCount = counts[sId];
        modeSignId = sId;
      }
    });

    const agreementRatio = maxCount / this.buffer.length;
    const avgConfidence =
      modeSignId !== null
        ? confidences[modeSignId].reduce((a, b) => a + b, 0) / confidences[modeSignId].length
        : 0;

    const stabilityScore = Math.min(1.0, agreementRatio * avgConfidence);
    const candidateSign = this.buffer.find((p) => p.signId === modeSignId) || rawPrediction;

    const meetsThreshold =
      this.buffer.length >= Math.floor(this.windowSize * 0.6) &&
      agreementRatio >= this.minAgreementRatio &&
      avgConfidence >= this.minConfidence;

    const isSameAsLast = this.lastConfirmedSign && this.lastConfirmedSign.signId === candidateSign.signId;
    const isWithinCooldown = isSameAsLast && now - this.lastConfirmedTime < this.cooldownMs;

    let isConfirmed = false;

    if (meetsThreshold && !isWithinCooldown) {
      isConfirmed = true;
      this.lastConfirmedSign = candidateSign;
      this.lastConfirmedTime = now;

      if (onConfirmed) {
        onConfirmed(candidateSign);
      }
    }

    return {
      currentSign: rawPrediction,
      stableSign: meetsThreshold ? candidateSign : null,
      stabilityScore: Math.round(stabilityScore * 100) / 100,
      confidence: Math.round(avgConfidence * 100) / 100,
      isConfirmed: isConfirmed,
      inCooldown: isWithinCooldown
    };
  }

  /**
   * Resets the temporal buffer.
   */
  reset() {
    this.buffer = [];
    this.lastConfirmedSign = null;
    this.lastConfirmedTime = 0;
    this.noHandCount = 0;
  }
}
