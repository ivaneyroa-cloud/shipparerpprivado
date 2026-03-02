"use client";

import { useCallback } from 'react';

// Frequencies for our synthetic sounds
const NOTES = {
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
    G5: 783.99,
    C6: 1046.50
};

export function useAudioFeedback() {
    const playTone = useCallback((freq: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            gainNode.gain.setValueAtTime(vol, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.error("Audio playback failed", e);
        }
    }, []);

    const playSuccess = useCallback(() => {
        // A nice satisfying double-chime (e.g. E5 then C6)
        playTone(NOTES.E5, 'sine', 0.1, 0.1);
        setTimeout(() => playTone(NOTES.C6, 'sine', 0.3, 0.15), 100);
    }, [playTone]);

    const playPop = useCallback(() => {
        // A subtle, rapid drop for a "click/pop" sound
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);

            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } catch (e) { }
    }, []);

    const playError = useCallback(() => {
        // A low, flat buzz
        playTone(150, 'sawtooth', 0.3, 0.05);
        setTimeout(() => playTone(150, 'sawtooth', 0.4, 0.05), 150);
    }, [playTone]);

    return { playSuccess, playPop, playError };
}
