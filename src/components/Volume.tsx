import type { MouseEvent } from 'react';
import { ChevronsUp, Volume1, Volume2, VolumeX } from '../icons';
import { send, usePart } from '../live';
import { openMenu } from '../ui';
import { cls } from '../util';
import { useReach } from '../reach';
import * as VolumeBoost from '../base/volumeBoost';
import type { Playback } from '../types';

/*
 * The volume, and the booster in its popover: the volume button opens it, as the desktop's does. The boost button
 * there switches the booster on -- at the last level, 200% the first time -- and shows its slider, 100% to 1000%;
 * past 200% it says to mind ears and speakers. While it is on, the volume button says so ("×4"), so it is never
 * forgotten; where the sound is out of its reach -- YouTube's own player, Spotify's app -- it says that instead.
 */

/** The booster's level as chosen, from the playback part, or the old switch's 200% from a Noctorium before levels. */
export function boostPercent(playback?: Playback): number {
  if (playback?.volumeBoostPercent != null) return VolumeBoost.clamp(playback.volumeBoostPercent);
  return playback?.boost ? VolumeBoost.FIRST_PERCENT : VolumeBoost.OFF_PERCENT;
}

export function VolumeIcon({ playback, size = 18 }: { playback?: Playback; size?: number }) {
  const Icon = playback?.muted || (playback?.volume ?? 1) === 0 ? VolumeX : (playback?.volume ?? 1) < 0.5 ? Volume1 : Volume2;
  return <Icon size={size} />;
}

/** The volume button: the speaker, and the boost beside it while it is on where the music is. */
export function VolumeButton({ className, size = 18 }: { className?: string; size?: number }) {
  const playback = usePart('playback');
  const reach = useReach();
  const percent = boostPercent(playback);
  const boosted = VolumeBoost.isOn(percent) && reach.boost.available;
  return (
    <button
      className={cls('round-button volume-button', boosted && 'boosted', className)}
      aria-label={boosted ? `Volume, boosted to ${VolumeBoost.percentLabel(percent)}` : 'Volume'}
      title={boosted ? `Boosted to ${VolumeBoost.percentLabel(percent)}` : 'Volume'}
      onClick={(e: MouseEvent<HTMLButtonElement>) => openMenu(e, <VolumePopover />)}
    >
      <VolumeIcon playback={playback} size={size} />
      {boosted && <span className="boost-mark">{VolumeBoost.timesLabel(percent)}</span>}
    </button>
  );
}

/** The volume slider, as the Centred bar has it beside the button. */
export function VolumeSlider({ className }: { className?: string }) {
  const playback = usePart('playback');
  const value = playback?.muted ? 0 : playback?.volume ?? 0.72;
  return (
    <input
      className={cls('bar volume', className)}
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      aria-label="Volume"
      style={{ ['--fill' as string]: `${value * 100}%` }}
      onChange={(e) => send('volume', { value: Number(e.target.value) })}
    />
  );
}

export function VolumePopover() {
  const playback = usePart('playback');
  const volume = playback?.muted ? 0 : playback?.volume ?? 0.72;
  return (
    <div className="volume-popover">
      <div className="heading">Volume</div>
      <div className="volume-row">
        <button className="round-button" data-keep aria-label={playback?.muted ? 'Unmute' : 'Mute'} onClick={() => send('mute')}>
          <VolumeIcon playback={playback} />
        </button>
        <VolumeSlider />
        <span className="figure">{Math.round(volume * 100)}%</span>
      </div>
      <hr />
      <BoostControl />
    </div>
  );
}

/** The boost button, and while it is on its slider and what it says: in the volume popover, and in Settings. */
export function BoostControl() {
  const playback = usePart('playback');
  const reach = useReach();
  const percent = boostPercent(playback);
  const on = VolumeBoost.isOn(percent);
  // A Noctorium from before the booster had levels has only its switch, and says nothing of where it reaches.
  const levels = playback?.volumeBoostPercent != null;
  const boost = (value: number) => send('boostPercent', { percent: VolumeBoost.snap(value) });
  return (
    <div className="boost-control">
      <div className="boost-head">
        <button
          className={cls('boost-toggle', on && reach.boost.available && 'on')}
          data-keep
          role="switch"
          aria-checked={on}
          disabled={!reach.boost.available}
          onClick={() => send('boost')}
        >
          <ChevronsUp size={16} /> Boost
        </button>
        {reach.boost.available && on && <span className="figure">{VolumeBoost.percentLabel(percent)} <small>{VolumeBoost.timesLabel(percent)}</small></span>}
      </div>
      {!reach.boost.available ? (
        <p className="boost-note">{reach.boost.reason}</p>
      ) : on && levels ? (
        <>
          <input
            className={cls('bar boost', VolumeBoost.isLoud(percent) && 'loud')}
            type="range"
            min={VolumeBoost.OFF_PERCENT}
            max={VolumeBoost.MAX_PERCENT}
            step={VolumeBoost.STEP_PERCENT}
            value={percent}
            aria-label="Boost"
            aria-valuetext={VolumeBoost.percentLabel(percent)}
            style={{ ['--fill' as string]: `${((percent - VolumeBoost.OFF_PERCENT) / (VolumeBoost.MAX_PERCENT - VolumeBoost.OFF_PERCENT)) * 100}%` }}
            onChange={(e) => boost(Number(e.target.value))}
          />
          <div className="boost-scale" aria-hidden><span>100%</span><span>1000%</span></div>
          {VolumeBoost.isLoud(percent) && <p className="boost-note loud">{VolumeBoost.LOUD_WARNING}</p>}
          {reach.boost.waiting && <p className="boost-note">It starts with your next tap or key: the browser asks for one before it lets a page work on its sound.</p>}
        </>
      ) : (
        <p className="boost-note">{levels ? 'Louder than full, up to 1000%, behind a limiter so it gets loud rather than broken.' : 'Louder than full, on the computer’s speakers.'}</p>
      )}
    </div>
  );
}
