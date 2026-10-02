import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Music2 } from 'lucide-react';
import type { Provider } from '../types';
import { closeDialog, closeMenu, useUi } from '../ui';
import { cls, providerBadge, providerName } from '../util';

export function Cover({ url, className, round, alt = '', children }: { url?: string; className?: string; round?: boolean; alt?: string; children?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className={cls('cover', className)} style={round ? { borderRadius: '50%' } : undefined}>
      {url && !failed ? (
        <img src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <div className="placeholder"><Music2 size={28} /></div>
      )}
      {children}
    </div>
  );
}

export function Badge({ provider }: { provider: Provider }) {
  return <span className={cls('badge', provider)} title={providerName[provider]}>{providerBadge[provider]}</span>;
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function Eq() {
  return <span className="eq" aria-hidden><i /><i /><i /></span>;
}

export function Switch({ on, change, label }: { on: boolean; change: (on: boolean) => void; label: string }) {
  return <button className={cls('switch', on && 'on')} role="switch" aria-checked={on} aria-label={label} onClick={() => change(!on)} />;
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  );
}

/** The dialog and the menu, wherever they were opened from. */
export function Layers() {
  const { dialog, menu } = useUi();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) { setPosition(null); return; }
    const box = menuRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(menu.x - box.width, window.innerWidth - box.width - 8));
    const below = menu.y + box.height < window.innerHeight - 8;
    const top = below ? menu.y : Math.max(8, menu.y - box.height - 44);
    setPosition({ left, top });
  }, [menu]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (menu) closeMenu();
      else if (dialog) closeDialog();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [menu, dialog]);

  return (
    <>
      {dialog && (
        <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
          {dialog}
        </div>
      )}
      {menu && (
        <div className="scrim" style={{ background: 'transparent', animation: 'none' }} onMouseDown={(e) => { if (e.target === e.currentTarget) closeMenu(); }}>
          <div
            ref={menuRef}
            className="menu"
            style={position ? { left: position.left, top: position.top } : { left: -9999, top: -9999 }}
            onClick={(e) => { if ((e.target as HTMLElement).closest('button[data-keep]') == null && (e.target as HTMLElement).closest('button')) closeMenu(); }}
          >
            {menu.content}
          </div>
        </div>
      )}
    </>
  );
}

export function Dialog({ title, children, buttons }: { title: string; children?: ReactNode; buttons?: ReactNode }) {
  return (
    <div className="dialog" role="dialog" aria-label={title}>
      <h3>{title}</h3>
      {children}
      {buttons && <div className="buttons">{buttons}</div>}
    </div>
  );
}

/** Asks for a line of text: a playlist's name, a token. */
export function Prompt({ title, hint, initial = '', secret, action = 'Save', submit }: { title: string; hint?: string; initial?: string; secret?: boolean; action?: string; submit: (text: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <Dialog
      title={title}
      buttons={
        <>
          <button className="button" onClick={closeDialog}>Cancel</button>
          <button className="button primary" disabled={!text.trim()} onClick={() => { closeDialog(); submit(text.trim()); }}>{action}</button>
        </>
      }
    >
      {hint && <p>{hint}</p>}
      <input
        className="field"
        autoFocus
        type={secret ? 'password' : 'text'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { closeDialog(); submit(text.trim()); } }}
      />
    </Dialog>
  );
}

export function Confirm({ title, detail, action = 'Yes', danger, yes }: { title: string; detail?: string; action?: string; danger?: boolean; yes: () => void }) {
  return (
    <Dialog
      title={title}
      buttons={
        <>
          <button className="button" onClick={closeDialog}>Cancel</button>
          <button className={cls('button', danger ? 'danger' : 'primary')} autoFocus onClick={() => { closeDialog(); yes(); }}>{action}</button>
        </>
      }
    >
      {detail && <p>{detail}</p>}
    </Dialog>
  );
}

/** A QR code, drawn by Noctorium, for a phone to scan. */
export function QrDialog({ title, text, children, onClose }: { title: string; text: string; children?: ReactNode; onClose?: () => void }) {
  return (
    <Dialog title={title} buttons={<button className="button" onClick={() => { closeDialog(); onClose?.(); }}>Close</button>}>
      <img className="qr" src={`/api/qr?text=${encodeURIComponent(text)}`} alt="" />
      {children}
    </Dialog>
  );
}
