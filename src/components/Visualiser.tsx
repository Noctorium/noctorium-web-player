import { useEffect, useLayoutEffect, useRef } from 'react';
import { send, usePart } from '../live';
import { sound } from '../sound';
import { feed } from '../feed';
import { useReach } from '../reach';
import { useLooks } from '../looks';
import { shownWith, wants } from '../base/looks';
import { BAND_COUNT, FRAME_MS, settle } from '../base/visualiser';
import { cls } from '../util';

/*
 * The visualiser in the Playlist layout's info bar: the real sound, or nothing.
 *
 * Bars are the spectrum in Base's ten bands, the same heights the terminal, the desktop and the phone draw for the
 * same sound; the level meter is each channel's RMS, with a tick at its peak. Fed from this tab's own sound
 * through an AnalyserNode when the page is the speaker, or from what mpv measures when the computer is; drawn on a
 * canvas in animation frames, so nothing is measured or drawn while it is off the screen. Where the sound cannot
 * be reached -- YouTube's own player, Spotify's app, another browser -- it says so instead of drawing a pattern.
 */

/** A frame from the computer older than this is a frame from before a pause: the bars fall. */
const STALE_MS = 400;

export function Visualiser({ className }: { className?: string }) {
  const looks = useLooks();
  const reach = useReach();
  const playback = usePart('playback');
  const style = looks.visualiser;
  const shown = shownWith(style, reach.analysis);
  const local = reach.where === 'here';
  const box = useRef<HTMLCanvasElement>(null);

  // Ask for what is drawn, for as long as it is drawn: of this tab's own sound, or of the computer's.
  useEffect(() => {
    if (shown === 'OFF') return;
    const kind = wants(shown);
    if (local) return sound.watch(kind);
    if (reach.where !== 'computer') return;
    send('analysis', { kind });
    return () => { send('analysis', { kind: 'NONE' }); };
  }, [shown, local, reach.where]);

  useLayoutEffect(() => {
    const canvas = box.current;
    if (!canvas || shown === 'OFF') return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const bars = new Array<number>(BAND_COUNT).fill(0);
    const peaks = [0, 0];
    const rms = [0, 0];
    const measuredBands = new Array<number>(BAND_COUNT).fill(0);
    const measuredPeaks = [0, 0];
    const measuredRms = [0, 0];
    let channels = 2;
    let last = performance.now();
    let frame = 0;
    let lastRead = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const elapsed = Math.min(100, now - last);
      last = now;
      // Read at most thirty times a second, as every player's feed runs; draw every frame between.
      if (now - lastRead >= FRAME_MS) {
        lastRead = now;
        read();
      }
      if (shown === 'BARS') for (let i = 0; i < BAND_COUNT; i++) bars[i] = settle(bars[i], measuredBands[i], elapsed);
      else for (let i = 0; i < 2; i++) { peaks[i] = settle(peaks[i], measuredPeaks[i], elapsed); rms[i] = settle(rms[i], measuredRms[i], elapsed); }
      paint();
    };

    const read = () => {
      if (local) {
        if (shown === 'BARS') { if (!sound.spectrum(measuredBands)) measuredBands.fill(0); }
        else {
          const heard = sound.levels(measuredPeaks, measuredRms);
          if (!heard) { measuredPeaks.fill(0); measuredRms.fill(0); }
          channels = heard || 2;
        }
        return;
      }
      const f = feed.frame;
      const fresh = f && performance.now() - feed.at < STALE_MS;
      if (shown === 'BARS') for (let i = 0; i < BAND_COUNT; i++) measuredBands[i] = fresh ? f.bands[i] ?? 0 : 0;
      else {
        channels = fresh && f.peaks.length ? Math.min(2, f.peaks.length) : 2;
        for (let i = 0; i < 2; i++) {
          measuredPeaks[i] = fresh ? f.peaks[Math.min(i, f.peaks.length - 1)] ?? 0 : 0;
          measuredRms[i] = fresh ? f.rms[Math.min(i, f.rms.length - 1)] ?? 0 : 0;
        }
      }
    };

    const paint = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(canvas.clientWidth * ratio);
      const height = Math.round(canvas.clientHeight * ratio);
      if (!width || !height) return;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const css = getComputedStyle(canvas);
      const colour = css.getPropertyValue('--vis-bar').trim() || css.color;
      const dim = css.getPropertyValue('--vis-rest').trim() || 'rgba(128,128,128,0.25)';
      const peakColour = css.getPropertyValue('--vis-peak').trim() || colour;
      context.clearRect(0, 0, width, height);
      if (shown === 'BARS') {
        const gap = Math.max(1, Math.round(2 * ratio));
        const barWidth = (width - gap * (BAND_COUNT - 1)) / BAND_COUNT;
        const floor = Math.max(1, Math.round(ratio));
        for (let i = 0; i < BAND_COUNT; i++) {
          const x = Math.round(i * (barWidth + gap));
          const w = Math.round((i + 1) * (barWidth + gap) - gap) - x;
          const h = Math.max(floor, Math.round(bars[i] * height));
          context.fillStyle = h <= floor ? dim : colour;
          context.fillRect(x, height - h, w, h);
        }
      } else {
        const rows = channels === 1 ? 1 : 2;
        const gap = Math.round(3 * ratio);
        const rowHeight = (height - gap * (rows - 1)) / rows;
        for (let i = 0; i < rows; i++) {
          const y = Math.round(i * (rowHeight + gap));
          const h = Math.round(rowHeight);
          context.fillStyle = dim;
          context.fillRect(0, y, width, h);
          context.fillStyle = colour;
          context.fillRect(0, y, Math.round(rms[i] * width), h);
          const tick = Math.round(peaks[i] * width);
          if (tick > 0) {
            context.fillStyle = peakColour;
            context.fillRect(Math.max(0, tick - Math.round(2 * ratio)), y, Math.round(2 * ratio), h);
          }
        }
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [shown, local]);

  if (style === 'OFF') return null;
  if (shown === 'OFF') {
    return (
      <div className={cls('visualiser', 'blind', className)} title={reach.analysisReason}>
        <span>{playback?.track ? 'Can’t see the audio' : ''}</span>
        {playback?.track && reach.analysisReason && <small>{reach.analysisReason}</small>}
      </div>
    );
  }
  return (
    <div className={cls('visualiser', shown === 'BARS' ? 'bars' : 'meter', className)} aria-hidden>
      <canvas ref={box} />
      {shown === 'LEVEL_METER' && <span className="channels"><i>L</i><i>R</i></span>}
    </div>
  );
}
