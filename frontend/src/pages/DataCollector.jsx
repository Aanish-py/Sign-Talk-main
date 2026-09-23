import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoTile from '../components/VideoTile';
import PermissionPrompt from '../components/PermissionPrompt';
import signsData from '../ml/signs.json';
import { useHandTracker } from '../ml/useHandTracker';
import { signClassifierService } from '../ml/signClassifier';
import { generateCanonicalDataset } from '../ml/canonicalDataset';

/**
 * DataCollector Page (Stage 3 & 4)
 * 
 * Interactive studio for:
 * - Recording normalized landmark frames for the 10 static ISL signs
 * - Visualizing dataset distribution across classes
 * - Training the TensorFlow.js neural network client-side
 * - Testing real-time inference on held gestures
 * - Exporting and importing datasets as JSON
 */
export default function DataCollector({ onNavigate }) {
  const [stream, setStream] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt');
  const [selectedSignId, setSelectedSignId] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(null);
  const [samplesTarget, setSamplesTarget] = useState(30);

  // Dataset storage: { [signId]: Array<Float32Array> }
  const [dataset, setDataset] = useState(() => {
    const canonical = generateCanonicalDataset(40);
    const initialMap = {};
    signsData.forEach(s => { initialMap[s.id] = []; });
    canonical.rawSamples.forEach(sample => {
      initialMap[sample.signId].push(sample.vector);
    });
    return initialMap;
  });

  // Training state
  const [isTraining, setIsTraining] = useState(false);
  const [trainingLogs, setTrainingLogs] = useState(null);
  const [trainingComplete, setTrainingComplete] = useState(false);

  // Live inference test
  const [testPrediction, setTestPrediction] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recordingSamplesCollectedRef = useRef(0);
  const isRecordingRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // MediaPipe hand tracker callback
  const handleResults = useCallback((data) => {
    const { normalizedVectors } = data;
    if (!normalizedVectors || normalizedVectors.length === 0) {
      setTestPrediction(null);
      return;
    }

    const primaryVector = normalizedVectors[0];

    // If recording is active, save sample to dataset
    if (isRecordingRef.current) {
      setDataset((prev) => {
        const currentList = prev[selectedSignId] || [];
        return {
          ...prev,
          [selectedSignId]: [...currentList, primaryVector]
        };
      });

      recordingSamplesCollectedRef.current++;
      if (recordingSamplesCollectedRef.current >= samplesTarget) {
        setIsRecording(false);
        recordingSamplesCollectedRef.current = 0;
      }
    }

    // Run live test inference
    if (signClassifierService.isReady && !isTraining) {
      signClassifierService.predict(primaryVector).then((pred) => {
        if (pred) {
          setTestPrediction(pred);
        }
      });
    }
  }, [selectedSignId, samplesTarget, isTraining]);

  const { isModelLoading, fps, latencyMs, detectedHandsCount } = useHandTracker(videoRef, canvasRef, {
    enabled: permissionState === 'granted',
    showSkeleton: true,
    onResults: handleResults
  });

  // Request camera access
  const requestMediaAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      setPermissionState('granted');
    } catch (err) {
      console.error('Camera access error:', err);
      setPermissionState('denied');
    }
  };

  // Start burst recording
  const startRecordingBurst = () => {
    if (detectedHandsCount === 0) {
      alert('Please hold your hand in front of the camera before recording.');
      return;
    }

    recordingSamplesCollectedRef.current = 0;
    setRecordingCountdown(3);

    const timer = setInterval(() => {
      setRecordingCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRecording(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Train Neural Network
  const handleTrainModel = async () => {
    setIsTraining(true);
    setTrainingComplete(false);
    setTrainingLogs(null);

    try {
      // Assemble features & one-hot labels
      const features = [];
      const labels = [];

      Object.entries(dataset).forEach(([signIdStr, samples]) => {
        const sId = parseInt(signIdStr, 10);
        samples.forEach((vec) => {
          const oneHot = new Array(signsData.length).fill(0);
          oneHot[sId] = 1;
          features.push(vec);
          labels.push(oneHot);
        });
      });

      if (features.length < 50) {
        alert('Please record or load at least 50 samples before training.');
        setIsTraining(false);
        return;
      }

      await signClassifierService.train(
        { features, labels },
        (logs) => {
          setTrainingLogs(logs);
        },
        30
      );

      setTrainingComplete(true);
      setIsTraining(false);
    } catch (err) {
      console.error('Training failed:', err);
      alert('Training failed: ' + err.message);
      setIsTraining(false);
    }
  };

  // Reset dataset to baseline
  const handleResetToBaseline = () => {
    if (window.confirm('Reset dataset to canonical synthetic templates?')) {
      const canonical = generateCanonicalDataset(40);
      const initialMap = {};
      signsData.forEach(s => { initialMap[s.id] = []; });
      canonical.rawSamples.forEach(sample => {
        initialMap[sample.signId].push(sample.vector);
      });
      setDataset(initialMap);
    }
  };

  // Export dataset as JSON
  const handleExportJSON = () => {
    const serializable = {};
    Object.entries(dataset).forEach(([sId, vectors]) => {
      serializable[sId] = vectors.map(v => Array.from(v));
    });

    const blob = new Blob([JSON.stringify(serializable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signspeak-dataset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import dataset from JSON
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        const newMap = {};
        signsData.forEach(s => { newMap[s.id] = []; });

        Object.entries(parsed).forEach(([sId, vectors]) => {
          newMap[sId] = vectors.map(v => new Float32Array(v));
        });

        setDataset(newMap);
        alert('Dataset imported successfully!');
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  // Total samples in dataset
  const totalSamples = Object.values(dataset).reduce((acc, curr) => acc + curr.length, 0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  const selectedSign = signsData.find(s => s.id === selectedSignId) || signsData[0];

  return (
    <div className="container" style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>🧠 AI Studio & Sign Dataset Collector</h2>
          <p style={{ fontSize: '0.95rem' }}>
            Record custom hand gestures, manage training samples, and train the TensorFlow.js neural network in your browser.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('preview')}>
            📷 Camera Test
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('landing')}>
            🏠 Home
          </button>
        </div>
      </div>

      {permissionState !== 'granted' ? (
        <PermissionPrompt onRequestPermission={requestMediaAccess} />
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: 'minmax(340px, 1.2fr) minmax(340px, 1fr)' }}>
          
          {/* Left Column: Live Webcam & Capture */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <VideoTile
              stream={stream}
              videoRef={videoRef}
              canvasRef={canvasRef}
              label={`Collector Camera (${fps} FPS)`}
              isLocal={true}
              statusBadge={
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {isRecording ? (
                    <span className="badge badge-danger">
                      🔴 RECORDING ({recordingSamplesCollectedRef.current}/{samplesTarget})
                    </span>
                  ) : (
                    <span className="badge badge-success">
                      {detectedHandsCount > 0 ? '🖐️ Hand in Frame' : '🔍 Hold Hand Up'}
                    </span>
                  )}
                </div>
              }
            />

            {/* Target Sign Selector Card */}
            <div className="card">
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                Select Target Sign to Record:
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                {signsData.map((sign) => {
                  const count = dataset[sign.id]?.length || 0;
                  const isSelected = sign.id === selectedSignId;
                  return (
                    <button
                      key={sign.id}
                      onClick={() => setSelectedSignId(sign.id)}
                      style={{
                        padding: '0.6rem 0.5rem',
                        textAlign: 'center',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'var(--accent-cyan)' : 'var(--bg-surface-elevated)',
                        color: isSelected ? 'var(--text-inverse)' : 'var(--text-main)',
                        border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                    >
                      <strong style={{ fontSize: '0.9rem' }}>{sign.displayText}</strong>
                      <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{count} samples</span>
                    </button>
                  );
                })}
              </div>

              {/* Target Pose Description */}
              <div className="notice-box notice-info" style={{ marginBottom: '1rem' }}>
                <strong>Target Pose ({selectedSign.displayText}):</strong>
                <p style={{ marginTop: '0.2rem', fontSize: '0.85rem' }}>{selectedSign.description}</p>
              </div>

              {/* Burst Capture Controls */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={startRecordingBurst}
                  disabled={isRecording || recordingCountdown !== null || detectedHandsCount === 0}
                  style={{ flex: 1 }}
                >
                  {recordingCountdown !== null
                    ? `⏱️ Starting in ${recordingCountdown}s...`
                    : isRecording
                    ? `Recording (${recordingSamplesCollectedRef.current}/${samplesTarget})...`
                    : `🔴 Record ${samplesTarget} Samples`}
                </button>

                <select
                  className="form-input"
                  style={{ width: '110px', padding: '0.6rem' }}
                  value={samplesTarget}
                  onChange={(e) => setSamplesTarget(Number(e.target.value))}
                >
                  <option value={15}>15 frames</option>
                  <option value={30}>30 frames</option>
                  <option value={50}>50 frames</option>
                </select>
              </div>
            </div>

          </div>

          {/* Right Column: Training Studio & Live Test */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Live Model Prediction Test Card */}
            <div className="card" style={{ border: '2px solid var(--border-prominent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3>🧪 Live Gesture Inference Test</h3>
                <span className={`badge ${testPrediction ? 'badge-success' : 'badge-secondary'}`}>
                  {testPrediction ? 'Model Active' : 'Waiting for Hand'}
                </span>
              </div>

              {testPrediction ? (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-primary)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '0.75rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                        {testPrediction.displayText}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        TTS Spoken: "{testPrediction.ttsText}"
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: testPrediction.confidence > 0.8 ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
                        {Math.round(testPrediction.confidence * 100)}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confidence</div>
                    </div>
                  </div>

                  {/* Top 3 Predictions Bar */}
                  <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {testPrediction.probabilities
                      .map((prob, idx) => ({ sign: signsData[idx], prob }))
                      .sort((a, b) => b.prob - a.prob)
                      .slice(0, 3)
                      .map(({ sign, prob }) => (
                        <div key={sign.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: '90px', color: 'var(--text-secondary)' }}>{sign.name}:</span>
                          <div style={{ flex: 1, background: 'var(--bg-surface)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round(prob * 100)}%`, height: '100%', background: 'var(--accent-cyan)' }} />
                          </div>
                          <span style={{ width: '35px', textAlign: 'right', fontWeight: 600 }}>{Math.round(prob * 100)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Hold your hand in camera view to test model prediction.
                </div>
              )}
            </div>

            {/* In-Browser Neural Network Training Card */}
            <div className="card">
              <h3>⚡ In-Browser Model Trainer</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '1rem' }}>
                Total Dataset Size: <strong>{totalSamples} samples</strong> across {signsData.length} signs.
              </p>

              <button
                className="btn btn-primary"
                onClick={handleTrainModel}
                disabled={isTraining}
                style={{ width: '100%', marginBottom: '1rem' }}
              >
                {isTraining ? '🧠 Training Neural Network...' : '🚀 Train TensorFlow.js Model (1-2s)'}
              </button>

              {/* Real-time Epoch Logs */}
              {trainingLogs && (
                <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <span>Epoch {trainingLogs.epoch} / {trainingLogs.totalEpochs}</span>
                    <strong style={{ color: 'var(--accent-cyan)' }}>Accuracy: {trainingLogs.accuracy}%</strong>
                  </div>
                  <div style={{ width: '100%', background: 'var(--bg-surface)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                    <div style={{ width: `${(trainingLogs.epoch / trainingLogs.totalEpochs) * 100}%`, height: '100%', background: 'var(--accent-cyan)', transition: 'width 0.1s linear' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Loss: {trainingLogs.loss}</span>
                    {trainingLogs.valAccuracy && <span>Val Acc: {trainingLogs.valAccuracy}%</span>}
                  </div>
                </div>
              )}

              {trainingComplete && (
                <div className="notice-box notice-info" style={{ marginBottom: '1rem' }}>
                  ✅ <strong>Model Trained Successfully!</strong> Saved to browser IndexedDB storage.
                </div>
              )}

              {/* Dataset Management Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={handleExportJSON} style={{ flex: 1, minHeight: 'auto', padding: '0.5rem', fontSize: '0.85rem' }}>
                  💾 Export JSON
                </button>

                <label className="btn btn-secondary" style={{ flex: 1, minHeight: 'auto', padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center' }}>
                  📂 Import JSON
                  <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
                </label>

                <button className="btn btn-secondary" onClick={handleResetToBaseline} style={{ flex: 1, minHeight: 'auto', padding: '0.5rem', fontSize: '0.85rem' }}>
                  🔄 Reset Baseline
                </button>
              </div>

            </div>

          </div>

        </div>
      )}
    </div>
  );
}
