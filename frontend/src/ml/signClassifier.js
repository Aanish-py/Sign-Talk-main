import * as tf from '@tensorflow/tfjs';
import signsData from './signs.json';
import { generateCanonicalDataset } from './canonicalDataset';

const MODEL_STORAGE_KEY = 'indexeddb://signspeak-classifier-model';

/**
 * SignClassifierService
 * 
 * Manages the TensorFlow.js deep neural network classifier for the 10 static ISL signs:
 * - 63-D Input Vector -> 128 -> 64 -> 32 -> 10 Softmax classes
 * - In-browser model training with real-time epoch callbacks
 * - Sub-5ms fast inference with tf.tidy memory isolation
 * - Model persistence in IndexedDB with automated baseline fallback
 */
class SignClassifierService {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.isReady = false;
    this.initPromise = null;
  }

  /**
   * Builds the Sequential Neural Network architecture.
   */
  createModelArchitecture() {
    const model = tf.sequential();

    // Input Layer + Hidden Layer 1
    model.add(
      tf.layers.dense({
        inputShape: [63],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      })
    );

    // Regularization Dropout to prevent overfitting on user-recorded hand samples
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Hidden Layer 2
    model.add(
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      })
    );

    // Hidden Layer 3
    model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        kernelInitializer: 'heNormal'
      })
    );

    // Output Layer (10 Softmax Probabilities)
    model.add(
      tf.layers.dense({
        units: signsData.length,
        activation: 'softmax'
      })
    );

    model.compile({
      optimizer: tf.train.adam(0.002),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Initializes the classifier. Loads saved model from IndexedDB,
   * or automatically trains on canonical baseline dataset in ~1.5 seconds.
   */
  async initialize(onProgress = null) {
    if (this.isReady && this.model) {
      return this.model;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        console.log('[TF.js] Initializing Sign Classifier...');
        await tf.ready();
        console.log('[TF.js] Backend ready:', tf.getBackend());

        // 1. Try loading previously saved model from IndexedDB
        try {
          const loadedModel = await tf.loadLayersModel(MODEL_STORAGE_KEY);
          loadedModel.compile({
            optimizer: tf.train.adam(0.002),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
          });
          this.model = loadedModel;
          this.isReady = true;
          console.log('[TF.js] Successfully loaded saved model from IndexedDB.');
          return this.model;
        } catch (loadErr) {
          console.log('[TF.js] No saved model found in IndexedDB. Training baseline model...');
        }

        // 2. Train baseline model on augmented canonical dataset
        const dataset = generateCanonicalDataset(60);
        await this.train(dataset, onProgress, 25);
        this.isReady = true;
        return this.model;
      } catch (err) {
        console.error('[TF.js] Initialization error:', err);
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Trains the neural network on provided dataset.
   * 
   * @param {{features: Array<Float32Array|Array<number>>, labels: Array<Array<number>>}} dataset 
   * @param {Function} onEpochEnd Callback function (info: {epoch, loss, accuracy, totalEpochs})
   * @param {number} epochs Number of training epochs (default: 30)
   */
  async train(dataset, onEpochEnd = null, epochs = 30) {
    if (!dataset || !dataset.features || dataset.features.length === 0) {
      throw new Error('Dataset contains no training samples.');
    }

    this.isTraining = true;

    try {
      // Discard previous model instance
      if (this.model) {
        this.model.dispose();
      }

      this.model = this.createModelArchitecture();

      const numSamples = dataset.features.length;
      const flatFeatures = [];
      dataset.features.forEach((vec) => {
        for (let i = 0; i < 63; i++) {
          flatFeatures.push(vec[i] || 0);
        }
      });

      const flatLabels = [];
      dataset.labels.forEach((oneHot) => {
        for (let i = 0; i < signsData.length; i++) {
          flatLabels.push(oneHot[i] || 0);
        }
      });

      const xs = tf.tensor2d(flatFeatures, [numSamples, 63]);
      const ys = tf.tensor2d(flatLabels, [numSamples, signsData.length]);

      console.log(`[TF.js] Training model on ${numSamples} samples for ${epochs} epochs...`);

      await this.model.fit(xs, ys, {
        epochs: epochs,
        batchSize: 32,
        shuffle: true,
        validationSplit: 0.15,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            if (onEpochEnd) {
              onEpochEnd({
                epoch: epoch + 1,
                totalEpochs: epochs,
                loss: logs.loss ? logs.loss.toFixed(4) : '0',
                accuracy: logs.acc ? (logs.acc * 100).toFixed(1) : (logs.accuracy ? (logs.accuracy * 100).toFixed(1) : '100'),
                valLoss: logs.val_loss ? logs.val_loss.toFixed(4) : null,
                valAccuracy: logs.val_acc ? (logs.val_acc * 100).toFixed(1) : (logs.val_accuracy ? (logs.val_accuracy * 100).toFixed(1) : null)
              });
            }
            // Yield to browser UI thread
            await tf.nextFrame();
          }
        }
      });

      xs.dispose();
      ys.dispose();

      // Save trained model to IndexedDB
      try {
        await this.model.save(MODEL_STORAGE_KEY);
        console.log('[TF.js] Trained model saved to IndexedDB.');
      } catch (saveErr) {
        console.warn('[TF.js] Could not save model to IndexedDB:', saveErr);
      }

      this.isReady = true;
      this.isTraining = false;
      return this.model;
    } catch (err) {
      this.isTraining = false;
      throw err;
    }
  }

  /**
   * Runs real-time inference on a 63-element normalized vector.
   * 
   * @param {Float32Array|Array<number>} normalizedVector 
   * @returns {{signId: number, name: string, displayText: string, ttsText: string, confidence: number, probabilities: Array<number>} | null}
   */
  predict(normalizedVector) {
    if (!this.model || !this.isReady || !normalizedVector || normalizedVector.length !== 63) {
      return null;
    }

    return tf.tidy(() => {
      const inputTensor = tf.tensor2d([Array.from(normalizedVector)], [1, 63]);
      const predictionTensor = this.model.predict(inputTensor);
      const probabilities = Array.from(predictionTensor.dataSync());

      // Find top predicted class
      let maxConfidence = -1;
      let topIndex = 0;

      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxConfidence) {
          maxConfidence = probabilities[i];
          topIndex = i;
        }
      }

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
        confidence: maxConfidence,
        probabilities: probabilities
      };
    });
  }

  /**
   * Resets model to canonical baseline.
   */
  async resetToBaseline(onProgress = null) {
    const dataset = generateCanonicalDataset(60);
    return this.train(dataset, onProgress, 25);
  }
}

export const signClassifierService = new SignClassifierService();
