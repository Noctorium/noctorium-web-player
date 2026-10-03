import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, Maximize2 } from 'lucide-react';
import { openNowPlaying, useUi } from '../ui';
import { load, save } from './store';
import { youtube } from './youtube';

/*
 * Where YouTube's player is shown while it plays: over the cover's place on the now playing screen, and in a
 * small card in a corner of the page otherwise -- never hidden, and never smaller than the 200 by 200 YouTube
 * asks of a page that embeds it.
 *
 * The player itself stays in one box at the end of the document for its whole life, because an iframe moved
 * in the document starts again from nothing. This only says where on the screen that box sits: it follows the
 * element marked .yt-slot while there is one, frame by frame, so it moves with the screen as it scrolls.
 */
export default function YouTubeStage() {
  const active = useSyncExternalStore(youtube.subscribe, () => youtube.active);
  const { nowPlaying } = useUi();
  const [left, setLeft] = useState(() => load('stageLeft', false));

  useEffect(() => {
    const stage = youtube.stage;
    stage.classList.toggle('on', active);
    if (!active) return;
    let frame = 0;
    let placed = '';
    const place = () => {
      const slot = nowPlaying ? document.querySelector<HTMLElement>('.yt-slot') : null;
      if (slot) {
        const r = slot.getBoundingClientRect();
        const where = `${r.left}|${r.top}|${r.width}|${r.height}`;
        if (where !== placed) {
          placed = where;
          stage.classList.add('in-slot');
          stage.classList.remove('floating');
          stage.style.left = `${r.left}px`;
          stage.style.top = `${r.top}px`;
          stage.style.width = `${r.width}px`;
          stage.style.height = `${r.height}px`;
          stage.style.borderRadius = getComputedStyle(slot).borderRadius;
        }
      } else if (placed !== 'floating') {
        placed = 'floating';
        stage.classList.remove('in-slot');
        stage.classList.add('floating');
        stage.removeAttribute('style');
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [active, nowPlaying]);

  useEffect(() => {
    youtube.stage.classList.toggle('left', left);
    save('stageLeft', left);
  }, [left]);

  if (!active) return null;
  return createPortal(
    <div className="yt-bar">
      <span className="ellipsis">YouTube</span>
      <button className="round-button" aria-label="Move to the other side" title="Move to the other side" onClick={() => setLeft(!left)}><ArrowLeftRight size={14} /></button>
      <button className="round-button" aria-label="Now playing" title="Now playing" onClick={() => openNowPlaying()}><Maximize2 size={14} /></button>
    </div>,
    youtube.stage,
  );
}
