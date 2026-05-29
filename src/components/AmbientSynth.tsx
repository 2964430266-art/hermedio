import React, { useEffect, useRef, useState } from "react";
import { CloudRain, Radio, Music4, Volume2, Sliders } from "lucide-react";

interface AmbientSynthProps {
  isPlayingParent: boolean;
}

export const AmbientSynth: React.FC<AmbientSynthProps> = ({ isPlayingParent }) => {
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  
  // Volume controls (0 to 1)
  const [rainVol, setRainVol] = useState<number>(0);
  const [vinylVol, setVinylVol] = useState<number>(0);
  const [rhodesVol, setRhodesVol] = useState<number>(0);

  // Sound nodes
  const nodesRef = useRef<{
    rainGain: GainNode | null;
    vinylGain: GainNode | null;
    rhodesGain: GainNode | null;
    rainNode: AudioWorkletNode | ScriptProcessorNode | null;
    vinylNode: ScriptProcessorNode | null;
    chordInterval: NodeJS.Timeout | null;
  }>({
    rainGain: null,
    vinylGain: null,
    rhodesGain: null,
    rainNode: null,
    vinylNode: null,
    chordInterval: null,
  });

  // Initialize AudioContext on user gesture
  const initAudioCtx = () => {
    if (!audioCtx) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioCtx(ctx);
      setupSynthesizers(ctx);
    } else if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  };

  const setupSynthesizers = (ctx: AudioContext) => {
    // 1. Gain nodes for volume control
    const rainGain = ctx.createGain();
    const vinylGain = ctx.createGain();
    const rhodesGain = ctx.createGain();

    rainGain.gain.setValueAtTime(0, ctx.currentTime);
    vinylGain.gain.setValueAtTime(0, ctx.currentTime);
    rhodesGain.gain.setValueAtTime(0, ctx.currentTime);

    // Apply lowpass filters to make it dark and warm
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "lowpass";
    rainFilter.frequency.setValueAtTime(1200, ctx.currentTime);

    const vinylFilter = ctx.createBiquadFilter();
    vinylFilter.type = "bandpass";
    vinylFilter.frequency.setValueAtTime(1000, ctx.currentTime);
    vinylFilter.Q.setValueAtTime(1.5, ctx.currentTime);

    // Dynamic Nodes connection
    rainFilter.connect(rainGain).connect(ctx.destination);
    vinylFilter.connect(vinylGain).connect(ctx.destination);
    rhodesGain.connect(ctx.destination);

    // Store refs
    nodesRef.current.rainGain = rainGain;
    nodesRef.current.vinylGain = vinylGain;
    nodesRef.current.rhodesGain = rhodesGain;

    // --- RAIN GENERATOR using ScriptProcessor (Noise synthesis) ---
    try {
      const rainNode = ctx.createScriptProcessor(4096, 1, 1);
      let lastOut = 0.0;
      rainNode.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < e.outputBuffer.length; i++) {
          const white = Math.random() * 2 - 1;
          // Pink noise filter approximation
          output[i] = (lastOut * 0.95 + white * 0.05);
          lastOut = output[i];
          // Add rhythmic rumbles for thunder
          if (i % 2000 === 0 && Math.random() < 0.02) {
             output[i] += (Math.random() * 0.5 - 0.25);
          }
        }
      };
      rainNode.connect(rainFilter);
      nodesRef.current.rainNode = rainNode;
    } catch (e) {
      console.warn("ScriptProcessor Rain synthesis unsupported:", e);
    }

    // --- VINYL CRACKLE GENERATOR ---
    try {
      const vinylNode = ctx.createScriptProcessor(4096, 1, 1);
      vinylNode.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < e.outputBuffer.length; i++) {
          // Continuous low level noise
          const tapeHiss = (Math.random() * 2 - 1) * 0.005;
          // Crackle pop trigger
          let pop = 0;
          if (Math.random() < 0.0003) {
            pop = (Math.random() > 0.5 ? 1 : -1) * (0.1 + Math.random() * 0.3);
          }
          output[i] = tapeHiss + pop;
        }
      };
      vinylNode.connect(vinylFilter);
      nodesRef.current.vinylNode = vinylNode;
    } catch (e) {
       console.warn("ScriptProcessor Vinyl crackle synthesis unsupported:", e);
    }

    // --- GENERATIVE LOFI RHODES CHORDS ---
    // Improvises moody lo-fi minor 9th / major 7th chords periodically
    startRhodesImprovisor(ctx, rhodesGain);
  };

  // Sound Synth Chord Helper
  const playLofiChord = (ctx: AudioContext, gainNode: GainNode, freqs: number[]) => {
    const playTime = ctx.currentTime;
    
    // Create a chain for rich echo/reverb feel
    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.4, playTime);
    
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.5, playTime);
    
    // Connect Delay
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, playTime);

    delay.connect(filter).connect(gainNode);

    // Warm Rhodes oscillators
    const oscs: OscillatorNode[] = [];
    const oscGains: GainNode[] = [];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      
      // Warm sound uses soft triangle wave + some subtle sine
      osc.type = Math.random() > 0.3 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq + (Math.random() * 1.5 - 0.75), playTime); // micro-detune for chorus effect
      
      const noteOffset = idx * 0.035; // slightly arpeggiate chords
      
      oscGain.gain.setValueAtTime(0, playTime);
      oscGain.gain.linearRampToValueAtTime(0.06, playTime + 0.15 + noteOffset);
      // long decay
      oscGain.gain.exponentialRampToValueAtTime(0.0001, playTime + 6.0 + noteOffset);

      osc.connect(oscGain).connect(filter).connect(gainNode);
      osc.connect(oscGain).connect(delay); // send to delay filter as well
      
      osc.start(playTime);
      osc.stop(playTime + 7.0);

      oscs.push(osc);
      oscGains.push(oscGain);
    });
  };

  const startRhodesImprovisor = (ctx: AudioContext, gainNode: GainNode) => {
    // Elegant lofi chords
    // Cmaj7 (9), Am9, Fmaj7 (9), Em9
    const chordBook = [
      [130.81, 164.81, 196.00, 246.94, 293.66], // Cmaj9
      [110.00, 130.81, 164.81, 196.00, 246.94], // Am9
      [87.31, 130.81, 174.61, 220.00, 261.63],  // Fmaj7
      [82.41, 116.54, 146.83, 164.81, 196.00, 246.94], // Em9
    ];

    let chordIdx = 0;

    const tick = () => {
      if (nodesRef.current.rhodesGain && nodesRef.current.rhodesGain.gain.value > 0.01) {
        const freqs = chordBook[chordIdx];
        playLofiChord(ctx, gainNode, freqs);
        chordIdx = (chordIdx + 1) % chordBook.length;
      }
    };

    // run chord play immediately, then every 8 seconds
    tick();
    const interval = setInterval(tick, 8500);
    nodesRef.current.chordInterval = interval;
  };

  // Update Rain Volume
  useEffect(() => {
    if (nodesRef.current.rainGain && audioCtx) {
      nodesRef.current.rainGain.gain.linearRampToValueAtTime(rainVol, audioCtx.currentTime + 0.5);
    }
  }, [rainVol, audioCtx]);

  // Update Vinyl Volume
  useEffect(() => {
    if (nodesRef.current.vinylGain && audioCtx) {
      nodesRef.current.vinylGain.gain.linearRampToValueAtTime(vinylVol, audioCtx.currentTime + 0.5);
    }
  }, [vinylVol, audioCtx]);

  // Update Rhodes Volume
  useEffect(() => {
    if (nodesRef.current.rhodesGain && audioCtx) {
      nodesRef.current.rhodesGain.gain.linearRampToValueAtTime(rhodesVol, audioCtx.currentTime + 0.5);
    }
  }, [rhodesVol, audioCtx]);

  // Clean-up
  useEffect(() => {
    return () => {
      if (nodesRef.current.chordInterval) {
        clearInterval(nodesRef.current.chordInterval);
      }
      if (audioCtx) {
        audioCtx.close();
      }
    };
  }, []);

  return (
    <div className="bg-white/40 backdrop-blur-md border border-neutral-200/40 p-4 rounded-2xl shadow-xl w-72 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <Sliders className="w-4 h-4 text-rose-500/80" />
        <h3 className="text-xs font-mono font-semibold text-neutral-700 uppercase tracking-wider">
          Ambient Sound Synthesizer
        </h3>
      </div>

      {!audioCtx ? (
        <button
          onClick={initAudioCtx}
          id="btn-enable-synth"
          className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 active:scale-[0.98] border border-rose-500/30 text-rose-600 rounded-lg text-xs font-medium font-sans flex items-center justify-center gap-2 transition"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          Click to Warm Soundscapes
        </button>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Rain Sound Channel */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-mono text-neutral-600 flex items-center gap-1.5 font-medium">
                <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                Rain Cascade
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {Math.round(rainVol * 100)}%
              </span>
            </div>
            <input
              id="slider-ambient-rain"
              type="range"
              min="0"
              max="0.4"
              step="0.01"
              value={rainVol}
              onChange={(e) => setRainVol(parseFloat(e.target.value))}
              className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-rose-400"
            />
          </div>

          {/* Vinyl Crackle Channel */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-mono text-neutral-600 flex items-center gap-1.5 font-medium">
                <Radio className="w-3.5 h-3.5 text-amber-500" />
                Vinyl Crackle
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {Math.round(vinylVol * 100)}%
              </span>
            </div>
            <input
              id="slider-ambient-vinyl"
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={vinylVol}
              onChange={(e) => setVinylVol(parseFloat(e.target.value))}
              className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-rose-400"
            />
          </div>

          {/* Gene Lofi Rhodes Chords Channel */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-mono text-neutral-600 flex items-center gap-1.5 font-medium">
                <Music4 className="w-3.5 h-3.5 text-purple-400" />
                Lofi Keyboard Chords
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {Math.round(rhodesVol * 100)}%
              </span>
            </div>
            <input
              id="slider-ambient-rhodes"
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={rhodesVol}
              onChange={(e) => setRhodesVol(parseFloat(e.target.value))}
              className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-rose-400"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 bg-neutral-100/60 p-2 rounded-lg leading-relaxed">
            <Volume2 className="w-3 h-3 text-rose-400 shrink-0" />
            <span>The synthesized sound loops in real time and can be mixed beautifully into any active music in the player.</span>
          </div>
        </div>
      )}
    </div>
  );
};
