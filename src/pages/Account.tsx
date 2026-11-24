import { useEffect, useRef, useState } from 'react';
import { send, usePart } from '../live';
import { Cover } from '../components/Common';
import { AccountRow, Row } from './Settings';

/*
 * The Noctorium account, opened from the picture at the top: signing in or out, and once signed in what the account
 * page on the website does -- the picture, the name, the email, the password and deleting it. The same commands go
 * to `noctorium web` and to the hosted player's engine, which calls the account service itself.
 */

/** The picture chosen, cut to its middle square and shrunk to 256×256, as a JPEG in base64. */
async function squareJpeg(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  canvas.getContext('2d')!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 256, 256);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

/** The picture, or the first letter of the name, round; for the top bar and this page. */
export function Avatar({ size }: { size: number }) {
  const account = usePart('account');
  const letter = (account?.signedIn && (account.name || account.email)?.trim()[0]?.toUpperCase()) || '?';
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {account?.signedIn && account.avatar ? <Cover url={account.avatar} round /> : letter}
    </span>
  );
}

export function AccountPage() {
  const account = usePart('account');
  const picker = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(account?.name ?? '');
  useEffect(() => setName(account?.name ?? ''), [account?.name]);
  const [email, setEmail] = useState('');
  const [fresh, setFresh] = useState('');
  const [confirm, setConfirm] = useState('');
  const [proof, setProof] = useState({ password: '', code: '' });
  const [codeSent, setCodeSent] = useState(false);
  const busy = !!account?.profileBusy;
  const profile = (action: string, fields: Record<string, unknown> = {}) => send('noctoriumProfile', { action, ...fields });
  const proven = (action: string, fields: Record<string, unknown>) => profile(action, { ...fields, code: proof.code || undefined });
  const needsCode = !!(account?.twoStep?.totp || account?.twoStep?.telegram);
  const ready = (!account?.hasPassword || !!proof.password) && (!needsCode || !!proof.code.trim());

  async function choose(file?: File) {
    if (file) send('noctoriumAvatar', { jpegBase64: await squareJpeg(file) });
  }

  return (
    <div className="settings account-page">
      <div className="settings-head"><h1 className="page-title">Your account</h1></div>
      <section>
        <AccountRow />
      </section>
      {account?.signedIn && (
        <>
          <section>
            <h2 className="legend">Profile</h2>
            {account.profileError && <p className="account-error" role="alert">{account.profileError}</p>}
            <Row setting="account-picture" title="Picture" detail={<span className="account-picture"><Avatar size={64} /></span>}>
              <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
              <button className="button small primary" disabled={busy} onClick={() => picker.current?.click()}>Choose…</button>
              {account.linked?.discord && <button className="button small" disabled={busy} onClick={() => profile('avatar-discord')}>Discord’s</button>}
              {account.linked?.telegram && <button className="button small" disabled={busy} onClick={() => profile('avatar-telegram')}>Telegram’s</button>}
              {account.avatar && <button className="button small" disabled={busy} onClick={() => profile('avatar-remove')}>Remove</button>}
            </Row>
            <Row setting="account-name" title="Name">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
              <button className="button small" disabled={busy || !name.trim() || name === account.name} onClick={() => profile('name', { name: name.trim() })}>Save</button>
            </Row>
          </section>
          <section>
            <h2 className="legend">Sign-in and security</h2>
            {(account.hasPassword || needsCode) && (
              <Row setting="account-proof" title="Prove it is you" wide
                detail="A new email or password, or deleting the account, needs this. Changing the email or password signs your other devices out.">
                {account.hasPassword && <input className="field" type="password" autoComplete="current-password" placeholder="Current password" value={proof.password} onChange={(e) => setProof({ ...proof, password: e.target.value })} />}
                {needsCode && <input className="field" inputMode="numeric" autoComplete="one-time-code" placeholder={account.twoStep?.totp ? 'Authenticator, Telegram or backup code' : 'Telegram or backup code'} value={proof.code} onChange={(e) => setProof({ ...proof, code: e.target.value })} />}
                {account.twoStep?.telegram && <button className="button small" disabled={busy} onClick={() => { send('noctoriumTelegramCode', {}); setCodeSent(true); }}>{codeSent ? 'Send again' : 'Send Telegram code'}</button>}
              </Row>
            )}
            <Row setting="account-email" title="Email" detail={account.email || 'None yet'}>
              <input className="field" type="email" autoComplete="email" placeholder="New email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="button small" disabled={busy || !email.trim() || !ready} onClick={() => proven('email', { email: email.trim(), password: proof.password || undefined })}>Change</button>
            </Row>
            <Row setting="account-password" title={account.hasPassword ? 'Password' : 'Add a password'} detail={account.hasPassword ? undefined : 'To sign in with your email too.'}>
              <input className="field" type="password" autoComplete="new-password" placeholder="New password" value={fresh} onChange={(e) => setFresh(e.target.value)} />
              <button className="button small" disabled={busy || !fresh || !ready} onClick={() => { proven('password', { password: fresh, current: proof.password || undefined }); setFresh(''); }}>Change</button>
            </Row>
            <Row setting="account-delete" title="Delete the account" detail="Your listening, links and devices go with it, for good. Type “delete my account” to confirm.">
              <input className="field" placeholder="delete my account" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type delete my account" />
              <button className="button small danger" disabled={busy || confirm.trim().toLowerCase() !== 'delete my account' || !ready}
                onClick={() => proven('delete', { confirm, password: proof.password || undefined })}>Delete</button>
            </Row>
          </section>
        </>
      )}
    </div>
  );
}
