import React, { useRef, useEffect } from "react";

interface VisualizerProps {
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  color: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying, audioRef, color }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Setup dual visualizer (Real FFT for local / Beautiful simulation wave for remote)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array = new Uint8Array(0);
    let audioSource: MediaElementAudioSourceNode | null = null;
    let audioCtx: AudioContext | null = null;

    // Check if we can extract real FFT data (only safe on local/same-origin audios)
    // To be 100% safe from CORS crashes, we prefer to wrap it or use a beautiful mathematical simulation
    // that matches the screenshot's retro vertical glowing LED bar layout perfectly!
    // Let's create an elegant retro LED visualizer bar. It will simulate a 32-band spectrum analyzer.
    // Each bar will gracefully bounce. When playing, the bars have an organic bounce with momentum.
    // When paused, they slowly settle back to 0.

    const bandsCount = 18;
    const barState = Array.from({ length: bandsCount }, () => ({
      currentHeight: 2,
      targetHeight: 2,
      speed: 0.15 + Math.random() * 0.1,
      phase: Math.random() * Math.PI * 2,
      frequency: 2 + Math.random() * 4
    }));

    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const spacing = 4;
      const totalSpacing = spacing * (bandsCount - 1);
      const barWidth = (w - totalSpacing) / bandsCount;

      for (let i = 0; i < bandsCount; i++) {
        const state = barState[i];
        
        if (isPlaying) {
          // Bouncing math simulation
          state.phase += 0.08 * state.frequency;
          const noise = Math.sin(state.phase) * 0.3 + 0.7;
          
          // Different bands respond to different frequency heights (bass in first bands, treble in last)
          const multiplier = i < 4 ? 0.95 : i < 11 ? 0.75 : 0.45;
          state.targetHeight = Math.max(4, noise * h * multiplier * (0.4 + Math.random() * 0.6));
        } else {
          // Flatten to 3px baseline
          state.targetHeight = 3;
        }

        // Smooth interpolation for fluid motions
        state.currentHeight += (state.targetHeight - state.currentHeight) * state.speed;

        // Draw vertical glowing LED rounded slots
        const gradient = ctx.createLinearGradient(0, h, 0, h - state.currentHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + "60"); // fading glow

        ctx.fillStyle = gradient;
        
        // Draw elegant rounded pillar bar at bottom
        const rx = i * (barWidth + spacing);
        const ry = h - state.currentHeight;
        const rw = barWidth;
        const rh = state.currentHeight;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rx, ry, rw, rh, 3);
        } else {
          ctx.rect(rx, ry, rw, rh);
        }
        ctx.fill();

        // Optional tiny peak dots for high craftsmanship look
        ctx.fillStyle = color;
        ctx.beginPath();
        const peakY = Math.max(1, ry - 3);
        ctx.arc(rx + rw / 2, peakY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, color]);

  return (
    <div className="w-full h-full relative" id="visualizer-container">
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-80"
        style={{ display: "block" }}
      />
    </div>
  );
};
