/**
 * Hand Skeleton Landmark Connections & Drawing Utilities
 */

export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [9, 10], [10, 11], [11, 12],
  // Ring finger
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm connections
  [5, 9], [9, 13], [13, 17]
];

const FINGERTIP_INDICES = new Set([4, 8, 12, 16, 20]);
const KNUCKLE_INDICES = new Set([1, 5, 9, 13, 17]);

/**
 * Draws the 21-point hand skeleton, joint landmarks, and handedness tag on a 2D canvas.
 * 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Array<Array<{x: number, y: number, z: number}>>} landmarksArray 
 * @param {Array<Array<{categoryName: string, score: number}>>} handednessArray 
 * @param {number} width 
 * @param {number} height 
 */
export function drawHandSkeleton(ctx, landmarksArray, handednessArray, width, height) {
  if (!ctx || !landmarksArray || landmarksArray.length === 0) {
    return;
  }

  ctx.save();

  landmarksArray.forEach((landmarks, handIndex) => {
    if (!landmarks || landmarks.length < 21) return;

    const handedness = handednessArray?.[handIndex]?.[0];
    const handLabel = handedness ? `${handedness.categoryName} (${Math.round(handedness.score * 100)}%)` : 'Hand';

    // 1. Draw Bone Connections
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.75)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#38bdf8'; // Neon cyan

    ctx.beginPath();
    HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      if (p1 && p2) {
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
      }
    });
    ctx.stroke();

    // Reset shadow for crisp joints
    ctx.shadowBlur = 0;

    // 2. Draw Landmark Joints
    landmarks.forEach((pt, idx) => {
      const x = pt.x * width;
      const y = pt.y * height;

      if (idx === 0) {
        // Wrist anchor
        ctx.fillStyle = '#fbbf24'; // Amber
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (FINGERTIP_INDICES.has(idx)) {
        // Fingertip keypoint
        ctx.fillStyle = '#f43f5e'; // Vibrant Rose
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      } else if (KNUCKLE_INDICES.has(idx)) {
        // Base Knuckles
        ctx.fillStyle = '#818cf8'; // Indigo
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        // Intermediate phalanges
        ctx.fillStyle = '#38bdf8'; // Cyan
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // 3. Draw Handedness Label Tag
    const wrist = landmarks[0];
    if (wrist) {
      const tagX = wrist.x * width;
      const tagY = Math.min(height - 15, Math.max(25, (wrist.y * height) + 24));

      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textWidth = ctx.measureText(handLabel).width;
      const padX = 8;
      const padY = 4;

      // Tag Background Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(tagX - textWidth / 2 - padX, tagY - 10 - padY, textWidth + padX * 2, 20 + padY * 2, 6);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tag Text
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(handLabel, tagX, tagY);
    }
  });

  ctx.restore();
}

/**
 * Clears the canvas buffer.
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {CanvasRenderingContext2D} ctx 
 */
export function clearCanvas(canvas, ctx) {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
