// Reads duration and grabs a poster frame from a video file before upload.
export function probeVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = url;
    const fail = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    v.onerror = fail;
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.5, v.duration / 2); };
    v.onseeked = () => {
      const scale = Math.min(1, 540 / v.videoWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((thumb) => { URL.revokeObjectURL(url); resolve({ duration: v.duration, thumb }); }, 'image/jpeg', 0.8);
    };
  });
}
export function extractHashtags(text) {
  return [...new Set((text.match(/#[a-z0-9_]{2,30}/gi) || []).map((t) => t.slice(1).toLowerCase()))].slice(0, 5);
}
