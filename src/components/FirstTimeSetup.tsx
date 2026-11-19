import { useState } from 'react';
import { send, usePart } from '../live';
import { go } from '../router';
import { cls } from '../util';
import { HOSTED } from '../mode';
import { Switch } from './Common';
import { SETUP_SEARCH_MODES, SETUP_STEPS, SETUP_THEMES, setupProgress } from '../base/setup';

/**
 * The first-time setup, in place of the page until it is finished or skipped: the steps of base/setup.ts, each with
 * Back, Next and "Skip setup". The hosted player has no accounts of its own to sign in to, and says where they are.
 */
export function FirstTimeSetup() {
  const settings = usePart('settings');
  const search = usePart('search');
  const [index, setIndex] = useState(0);
  if (!settings) return null;
  const { step, title, about } = SETUP_STEPS[index];
  const last = index === SETUP_STEPS.length - 1;
  const finish = () => send('finishSetup');
  const themes = settings.themes.filter((t) => SETUP_THEMES.includes(t.name));
  const mode = search?.mode ?? 'HYBRID';
  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-top">
          <div className="setup-dots">
            {SETUP_STEPS.map((s, i) => <i key={s.step} className={cls(i === index && 'now', i <= index && 'past')} />)}
          </div>
          {!last && <button className="button small" onClick={finish}>Skip setup</button>}
        </div>
        <div className="setup-progress">{setupProgress(index).toUpperCase()}</div>
        <h1>{title}</h1>
        <p className="setup-about">{step === 'ACCOUNTS' && HOSTED
          ? 'This player needs no account: what you like and the playlists you make are kept in this browser. For your own YouTube Music and SoundCloud, get Noctorium for your computer or phone.'
          : about}</p>
        {step === 'LOOK' && (
          <div className="setup-themes">
            {themes.map((t) => (
              <button key={t.name} className={cls('setup-theme', settings.theme === t.name && 'on')} onClick={() => send('theme', { name: t.name })}>
                <span className="setup-swatch"><i style={{ background: t.background }} /><i style={{ background: t.card }} /><i style={{ background: t.accent }} /></span>
                {t.title}
              </button>
            ))}
          </div>
        )}
        {step === 'SEARCH' && (
          <div className="chips setup-chips">
            {SETUP_SEARCH_MODES.map(([name, label]) => (
              <button key={name} className={cls('chip', mode === name && 'on')} onClick={() => send('searchMode', { mode: name })}>{label}</button>
            ))}
          </div>
        )}
        {step === 'LISTENING' && (
          <div className="setup-row">
            <div><b>Autoplay</b><span>Songs like the last one, when the queue runs out</span></div>
            <Switch on={settings.autoplay !== false} change={(on) => send('autoplay', { on })} label="Autoplay" />
          </div>
        )}
        {step === 'ACCOUNTS' && !HOSTED && (
          <button className="button" onClick={() => { finish(); go('/settings'); }}>Sign in now — YouTube Music, SoundCloud, Spotify and more</button>
        )}
        <div className="setup-bottom">
          {index > 0 && <button className="button" onClick={() => setIndex(index - 1)}>Back</button>}
          <span style={{ flex: 1 }} />
          <button className="button primary" onClick={() => (last ? finish() : setIndex(index + 1))}>
            {step === 'WELCOME' ? 'Get started' : last ? 'Start listening' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
