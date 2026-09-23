import signsData from './signs.json';
import { generateCanonicalDataset } from './canonicalDataset';

const ML_SERVER_URL = 'http://localhost:5001';

/**
 * SignClassifierService
 * 
 * Proxies neural network training and predictions to the Python ML server (port 5001):
 * - Predict: Sends 63-element landmark vector to Python
 * - Train: Sends canonical or custom datasets to Python for MLPClassifier fitting
 */
class SignClassifierService {
  constructor() {
    this.isTraining = false;
    this.isReady = false;
    this.initPromise = null;
  }

  /**
   * Initializes the classifier. Performs self-check against the Python ML server,
   * and automatically trains on canonical baseline dataset if the model is not initialized.
   */
  async initialize(onProgress = null) {
    if (this.isReady) {
      return true;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('[ML Client] Initializing connection to Python ML server...');
        
        // Check if server is reachable and if model is already loaded
        try {
          const dummyVector = new Array(63).fill(0);
          const checkRes = await fetch(`${ML_SERVER_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vector: dummyVector })
          });
          
          if (checkRes.ok) {
            console.log('[ML Client] Python ML server ready and model is pre-loaded.');
            this.isReady = true;
            return true;
          }
        } catch (e) {
          console.warn('[ML Client] Python ML server checking failed. Attempting baseline training...', e);
        }

        // If checking failed or model was not trained, train the baseline model
        console.log('[ML Client] Model not ready on Python server. Generating baseline dataset & training...');
        const dataset = generateCanonicalDataset(60);
        await this.train(dataset, onProgress, 25);
        this.isReady = true;
        return true;
      } catch (err) {
        console.error('[ML Client] Initialization error:', err);
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Sends features and labels to Python server to train.
   */
  async train(dataset, onEpochEnd = null, epochs = 30) {
    if (!dataset || !dataset.features || dataset.features.length === 0) {
      throw new Error('Dataset contains no training samples.');
    }

    this.isTraining = true;

    try {
      console.log(`[ML Client] Sending ${dataset.features.length} samples to Python backend for training...`);

      // Mock epoch callbacks for frontend visual state
      if (onEpochEnd) {
        onEpochEnd({
          epoch: 5,
          totalEpochs: 30,
          loss: 'Calculating...',
          accuracy: 'Training...'
        });
      }

      const response = await fetch(`${ML_SERVER_URL}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: dataset.features.map(f => Array.from(f)),
          labels: dataset.labels
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to train model on Python server');
      }

      const result = await response.json();
      console.log('[ML Client] Training completed successfully:', result);

      if (onEpochEnd) {
        onEpochEnd({
          epoch: epochs,
          totalEpochs: epochs,
          loss: result.loss.toFixed(4),
          accuracy: result.accuracy.toFixed(1)
        });
      }

      this.isReady = true;
      this.isTraining = false;
      return true;
    } catch (err) {
      this.isTraining = false;
      throw err;
    }
  }

  /**
   * Runs real-time inference via Python ML server.
   * 
   * @param {Float32Array|Array<number>} normalizedVector 
   * @returns {Promise<{signId: number, name: string, displayText: string, ttsText: string, confidence: number, probabilities: Array<number>} | null>}
   */
  async predict(normalizedVector) {
    if (!this.isReady || !normalizedVector || normalizedVector.length !== 63) {
      return null;
    }

    try {
      const response = await fetch(`${ML_SERVER_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector: Array.from(normalizedVector) })
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      const topIndex = result.signId;
      const confidence = result.confidence;
      const probabilities = result.probabilities;

      const signMeta = signsData[topIndex] || {
        id: topIndex,
        name: 'UNKNOWN',
        displayText: 'Unknown',
        ttsText: 'Unknown'
      };

      return {
        signId: topIndex,
        name: signMeta.name,
        displayText: signMeta.displayText,
        ttsText: signMeta.ttsText,
        confidence: confidence,
        probabilities: probabilities
      };
    } catch (err) {
      console.error('[ML Client] Prediction failed:', err);
      return null;
    }
  }

  /**
   * Resets model to canonical baseline.
   */
  async resetToBaseline(onProgress = null) {
    try {
      await fetch(`${ML_SERVER_URL}/reset`, { method: 'POST' });
    } catch (e) {
      console.warn('[ML Client] Reset request to Python failed:', e);
    }
    const dataset = generateCanonicalDataset(60);
    return this.train(dataset, onProgress, 25);
  }
}

export const signClassifierService = new SignClassifierService();
