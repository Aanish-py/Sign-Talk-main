/**
 * Landmark Normalization & Feature Extraction Pipeline
 * 
 * Standardizes 21 3D hand keypoints into an invariant 63-element feature vector:
 * 1. Translation Invariance: Shift all coordinates relative to Landmark 0 (Wrist).
 * 2. Scale Invariance: Divide by the maximum Euclidean distance to the wrist.
 * 
 * The resulting 63 floats are strictly bounded in [-1.0, 1.0].
 */

/**
 * Normalizes 21 hand landmarks into a 63-element 1D feature array.
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks 
 * @returns {Float32Array | null} 63-element normalized array
 */
export function normalizeLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return null;
  }

  const wrist = landmarks[0];
  const relativePoints = [];
  let maxDistance = 0.00001; // Avoid divide by zero

  // Step 1: Calculate wrist-relative coordinates and find max distance
  for (let i = 0; i < 21; i++) {
    const pt = landmarks[i];
    const dx = pt.x - wrist.x;
    const dy = pt.y - wrist.y;
    const dz = (pt.z !== undefined ? pt.z : 0) - (wrist.z !== undefined ? wrist.z : 0);

    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > maxDistance) {
      maxDistance = dist;
    }

    relativePoints.push(dx, dy, dz);
  }

  // Step 2: Scale-normalize by maxDistance into a flat 63-element array
  const normalizedVector = new Float32Array(63);
  for (let i = 0; i < 63; i++) {
    normalizedVector[i] = relativePoints[i] / maxDistance;
  }

  return normalizedVector;
}

/**
 * Analyzes whether each of the 5 fingers is extended or curled.
 * Useful for debugging and heuristics.
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks 
 * @returns {{thumb: boolean, index: boolean, middle: boolean, ring: boolean, pinky: boolean}}
 */
export function getFingerExtensionStates(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return { thumb: false, index: false, middle: false, ring: false, pinky: false };
  }

  const wrist = landmarks[0];

  const getDistance = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  // Finger is extended if TIP is further from wrist than PIP/MCP joint
  const isThumbExtended = getDistance(landmarks[4], wrist) > getDistance(landmarks[2], wrist) * 1.15;
  const isIndexExtended = getDistance(landmarks[8], wrist) > getDistance(landmarks[6], wrist);
  const isMiddleExtended = getDistance(landmarks[12], wrist) > getDistance(landmarks[10], wrist);
  const isRingExtended = getDistance(landmarks[16], wrist) > getDistance(landmarks[14], wrist);
  const isPinkyExtended = getDistance(landmarks[20], wrist) > getDistance(landmarks[18], wrist);

  return {
    thumb: isThumbExtended,
    index: isIndexExtended,
    middle: isMiddleExtended,
    ring: isRingExtended,
    pinky: isPinkyExtended
  };
}
