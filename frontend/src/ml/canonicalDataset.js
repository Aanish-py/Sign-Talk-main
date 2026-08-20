import signsData from './signs.json';
import { normalizeLandmarks } from './landmarkNormalizer';

/**
 * Canonical Landmark Template Generator for 10 ISL Static Key-Poses
 * 
 * Defines anatomically structured 21 3D hand landmarks for each sign:
 * 0: HELLO      (Open flat palm facing camera)
 * 1: YES        (Thumbs up, fingers curled)
 * 2: NO         (Thumbs down, fingers curled)
 * 3: THANK YOU  (Open palm upright, fingers together)
 * 4: PLEASE     (Open flat palm held flat inward)
 * 5: HELP       (Thumbs up resting on base open palm)
 * 6: SORRY      (Closed fist)
 * 7: STOP       (Open vertical palm, fingers spread)
 * 8: GOOD       (OK sign: Thumb tip & Index tip touching, others extended)
 * 9: LOVE       (ILY sign: Thumb, Index, Pinky extended; Middle & Ring curled)
 */

function createHandPose(fingerStates) {
  // fingerStates: { thumb: 'up'|'down'|'curl'|'touch'|'spread', index: 'ext'|'curl'|'touch', middle: 'ext'|'curl', ring: 'ext'|'curl', pinky: 'ext'|'curl', spread: number }
  const landmarks = [];

  // 0: Wrist
  landmarks.push({ x: 0.5, y: 0.8, z: 0.0 });

  // Base MCP X-offsets for 4 fingers (relative to wrist)
  const mcpOffsets = {
    index: { x: -0.09, y: -0.28 },
    middle: { x: -0.03, y: -0.30 },
    ring: { x: 0.03, y: -0.28 },
    pinky: { x: 0.08, y: -0.24 }
  };

  // 1-4: Thumb
  if (fingerStates.thumb === 'up') {
    // Thumbs Up
    landmarks.push({ x: 0.44, y: 0.72, z: -0.02 });
    landmarks.push({ x: 0.38, y: 0.62, z: -0.03 });
    landmarks.push({ x: 0.34, y: 0.50, z: -0.04 });
    landmarks.push({ x: 0.30, y: 0.36, z: -0.05 });
  } else if (fingerStates.thumb === 'down') {
    // Thumbs Down
    landmarks.push({ x: 0.44, y: 0.82, z: -0.02 });
    landmarks.push({ x: 0.38, y: 0.90, z: -0.03 });
    landmarks.push({ x: 0.34, y: 0.98, z: -0.04 });
    landmarks.push({ x: 0.30, y: 1.08, z: -0.05 });
  } else if (fingerStates.thumb === 'touch') {
    // Touching index tip (OK sign)
    landmarks.push({ x: 0.44, y: 0.70, z: -0.02 });
    landmarks.push({ x: 0.40, y: 0.60, z: -0.03 });
    landmarks.push({ x: 0.38, y: 0.52, z: -0.04 });
    landmarks.push({ x: 0.40, y: 0.45, z: -0.04 }); // meets index tip
  } else if (fingerStates.thumb === 'curl') {
    // Folded over curled fingers (Fist)
    landmarks.push({ x: 0.45, y: 0.73, z: -0.02 });
    landmarks.push({ x: 0.43, y: 0.66, z: -0.05 });
    landmarks.push({ x: 0.45, y: 0.60, z: -0.07 });
    landmarks.push({ x: 0.49, y: 0.58, z: -0.08 });
  } else {
    // Spread / Extended outward
    landmarks.push({ x: 0.42, y: 0.72, z: -0.02 });
    landmarks.push({ x: 0.34, y: 0.64, z: -0.03 });
    landmarks.push({ x: 0.28, y: 0.56, z: -0.04 });
    landmarks.push({ x: 0.22, y: 0.48, z: -0.05 });
  }

  // Generate 4 fingers (Index, Middle, Ring, Pinky)
  const fingers = ['index', 'middle', 'ring', 'pinky'];
  fingers.forEach((fName) => {
    const mcp = mcpOffsets[fName];
    const state = fingerStates[fName];
    const spread = (fingerStates.spread || 0) * (fName === 'index' ? -0.03 : fName === 'pinky' ? 0.03 : 0);

    const mcpX = 0.5 + mcp.x + spread;
    const mcpY = 0.8 + mcp.y;

    landmarks.push({ x: mcpX, y: mcpY, z: -0.01 });

    if (state === 'touch' && fName === 'index') {
      // Curve down to touch thumb tip (OK sign)
      landmarks.push({ x: mcpX - 0.01, y: mcpY - 0.08, z: -0.03 });
      landmarks.push({ x: mcpX - 0.02, y: mcpY - 0.05, z: -0.05 });
      landmarks.push({ x: 0.40, y: 0.45, z: -0.04 });
    } else if (state === 'curl') {
      // Curled into fist
      landmarks.push({ x: mcpX, y: mcpY + 0.05, z: -0.06 });
      landmarks.push({ x: mcpX, y: mcpY + 0.10, z: -0.08 });
      landmarks.push({ x: mcpX, y: mcpY + 0.07, z: -0.05 });
    } else {
      // Extended straight upward
      const len = fName === 'middle' ? 0.11 : fName === 'index' ? 0.10 : fName === 'ring' ? 0.095 : 0.08;
      landmarks.push({ x: mcpX + spread * 0.5, y: mcpY - len * 0.35, z: -0.02 });
      landmarks.push({ x: mcpX + spread * 0.8, y: mcpY - len * 0.70, z: -0.03 });
      landmarks.push({ x: mcpX + spread * 1.0, y: mcpY - len * 1.00, z: -0.04 });
    }
  });

  return landmarks;
}

// 10 Baseline Configurations
const POSE_CONFIGS = {
  0: { thumb: 'spread', index: 'ext', middle: 'ext', ring: 'ext', pinky: 'ext', spread: 0 },       // HELLO (Open flat palm)
  1: { thumb: 'up', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl', spread: 0 },        // YES (Thumbs up)
  2: { thumb: 'down', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl', spread: 0 },      // NO (Thumbs down)
  3: { thumb: 'spread', index: 'ext', middle: 'ext', ring: 'ext', pinky: 'ext', spread: -0.5 },    // THANK YOU (Together vertical)
  4: { thumb: 'curl', index: 'ext', middle: 'ext', ring: 'ext', pinky: 'ext', spread: -0.2 },      // PLEASE (Flat inward)
  5: { thumb: 'up', index: 'ext', middle: 'ext', ring: 'curl', pinky: 'curl', spread: 0 },         // HELP (Pose combo)
  6: { thumb: 'curl', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl', spread: 0 },      // SORRY (Closed fist)
  7: { thumb: 'spread', index: 'ext', middle: 'ext', ring: 'ext', pinky: 'ext', spread: 1.2 },     // STOP (Wide spread open palm)
  8: { thumb: 'touch', index: 'touch', middle: 'ext', ring: 'ext', pinky: 'ext', spread: 0.5 },    // GOOD (OK sign)
  9: { thumb: 'spread', index: 'ext', middle: 'curl', ring: 'curl', pinky: 'ext', spread: 0.8 }    // LOVE (ILY sign)
};

/**
 * Generates an augmented dataset of normalized feature vectors and one-hot labels.
 * 
 * @param {number} samplesPerClass Number of synthetic samples per sign (default: 60)
 * @returns {{features: Array<Float32Array>, labels: Array<Array<number>>, rawSamples: Array<{signId: number, vector: Float32Array}>}}
 */
export function generateCanonicalDataset(samplesPerClass = 60) {
  const features = [];
  const labels = [];
  const rawSamples = [];

  signsData.forEach((sign) => {
    const config = POSE_CONFIGS[sign.id] || POSE_CONFIGS[0];
    const basePose = createHandPose(config);

    for (let i = 0; i < samplesPerClass; i++) {
      // Perturb landmarks with slight noise, rotation & scale variations
      const angle = (Math.random() - 0.5) * 0.15; // +/- 8 degrees
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const scale = 0.9 + Math.random() * 0.2; // 0.9x to 1.1x

      const perturbedLandmarks = basePose.map((pt, idx) => {
        const jitterX = (Math.random() - 0.5) * (idx === 0 ? 0.005 : 0.025);
        const jitterY = (Math.random() - 0.5) * (idx === 0 ? 0.005 : 0.025);
        const jitterZ = (Math.random() - 0.5) * 0.02;

        const centeredX = (pt.x - 0.5) * scale;
        const centeredY = (pt.y - 0.8) * scale;

        const rotatedX = centeredX * cosA - centeredY * sinA + 0.5 + jitterX;
        const rotatedY = centeredX * sinA + centeredY * cosA + 0.8 + jitterY;
        const rotatedZ = (pt.z + jitterZ) * scale;

        return { x: rotatedX, y: rotatedY, z: rotatedZ };
      });

      const normalized = normalizeLandmarks(perturbedLandmarks);
      if (normalized) {
        // One-hot label for 10 classes
        const oneHot = new Array(signsData.length).fill(0);
        oneHot[sign.id] = 1;

        features.push(normalized);
        labels.push(oneHot);
        rawSamples.push({ signId: sign.id, vector: normalized });
      }
    }
  });

  return { features, labels, rawSamples };
}
