import { useState } from 'react';
import { X } from 'lucide-react';
import { load, save } from './store';

/** What the hosted player is, said once on Home until it is closed. */
export function HostedWelcome() {
  const [hidden, setHidden] = useState(() => load('welcomeHidden', false));
  if (hidden) return null;
  return (
    <div className="banner welcome">
      <span>
        Noctorium in your browser: YouTube Music and SoundCloud in one search, one queue and one player. What you like and
        the playlists you make are kept in this browser. For your own accounts — their likes, playlists and mixes — get{' '}
        <a href="https://noctorium.vercel.app" target="_blank" rel="noreferrer">Noctorium</a> for your computer or phone.
      </span>
      <button className="round-button" aria-label="Close" onClick={() => { save('welcomeHidden', true); setHidden(true); }}><X size={16} /></button>
    </div>
  );
}
