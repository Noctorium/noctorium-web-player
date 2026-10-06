import { useEffect } from 'react';
import { BookmarkCheck, BookmarkPlus, Download, ExternalLink, Globe, Library as LibraryIcon, Lock, Pencil, Play, Plus, RefreshCw, Shuffle, Trash2 } from 'lucide-react';
import { send, usePart } from '../live';
import { go, useRoute } from '../router';
import { bigArtwork, canKeep, keepsFiles, playlistKind, plural, providerName, totalTime } from '../util';
import { Badge, Confirm, Cover, Dialog, Empty, Prompt, Spinner } from '../components/Common';
import { LocalCard, PlaylistCard } from '../components/Cards';
import { TrackList } from '../components/Tracks';
import { closeDialog, openDialog } from '../ui';
import { useState } from 'react';
import type { Provider } from '../types';
import { HOSTED } from '../mode';

export function Library() {
  const library = usePart('library');
  const settings = usePart('settings');
  useEffect(() => { send('refreshLibrary'); }, []);
  // Bandcamp's are a fan's collection, a playlist for each release in it, and their wishlist; VK's, My music and
  // then the account's playlists.
  const groups: [Provider, string][] = [
    ['YOUTUBE_MUSIC', 'YouTube Music'], ['YOUTUBE_VIDEO', 'YouTube'], ['SOUNDCLOUD', 'SoundCloud'], ['SPOTIFY', 'Spotify'],
    ['BANDCAMP', 'Bandcamp'], ['VK', 'VK Music'],
  ];
  const fan = settings?.bandcamp?.username;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 className="page-title">Your library</h1>
        <span style={{ flex: 1 }} />
        {library?.loading && <Spinner />}
        {!HOSTED && <button className="button small" onClick={() => send('refreshLibrary', { force: true })}><RefreshCw size={15} /> Refresh</button>}
        <button className="button small primary" onClick={() => openDialog(HOSTED
          ? <Prompt title="New playlist" hint="Kept in this browser." action="Make it" submit={(title) => send('createPlaylist', { title, provider: 'LOCAL' })} />
          : <NewPlaylist />)}><Plus size={15} /> New playlist</button>
      </div>
      {library?.needsSoundCloudUsername && (
        <div className="banner">SoundCloud finds your playlists by your profile name.
          <button className="button small" style={{ marginLeft: 'auto' }} onClick={() => openDialog(
            <Prompt title="Your SoundCloud profile" hint="The name in soundcloud.com/<name>." submit={(name) => send('soundCloudUsername', { name: name.replace(/^https?:\/\/soundcloud\.com\//, '').replace(/\/$/, '') })} />,
          )}>Tell it</button>
        </div>
      )}
      {library?.error && <div className="banner">{library.error}</div>}
      {groups.map(([provider, title]) => {
        const lists = library?.playlists.filter((p) => p.provider === provider) ?? [];
        if (!lists.length) return null;
        return (
          <section key={provider}>
            <h2 className="shelf-title">{title}</h2>
            <p className="shelf-subtitle">{provider === 'BANDCAMP' && fan ? `Your collection at bandcamp.com/${fan}` : plural(lists.length, 'playlist')}</p>
            <div className="grid">{lists.map((p) => <PlaylistCard key={p.key} playlist={p} />)}</div>
          </section>
        );
      })}
      {library?.local.length ? (
        <section>
          <h2 className="shelf-title">{HOSTED ? 'Yours' : 'On the computer'}</h2>
          <p className="shelf-subtitle">{HOSTED ? 'Kept in this browser' : 'Kept in Noctorium, not on a service'}</p>
          <div className="grid">{library.local.map((p) => <LocalCard key={p.id} playlist={p} />)}</div>
        </section>
      ) : null}
      {library && !library.loading && !library.playlists.length && !library.local.length && (
        <Empty icon={<LibraryIcon size={44} />} title="No playlists yet">
          {HOSTED ? 'Make one here, or save one you find in Search.' : <>Sign in under <a href="/settings" onClick={(e) => { e.preventDefault(); go('/settings'); }}>Settings</a> to see yours, or make one here.</>}
        </Empty>
      )}
    </>
  );
}

function NewPlaylist() {
  const [title, setTitle] = useState('');
  const [where, setWhere] = useState('YOUTUBE_MUSIC');
  const [isPublic, setPublic] = useState(false);
  const make = () => { closeDialog(); send('createPlaylist', { title: title.trim(), provider: where, public: isPublic }); };
  return (
    <Dialog title="New playlist" buttons={<><button className="button" onClick={closeDialog}>Cancel</button><button className="button primary" disabled={!title.trim()} onClick={make}>Make it</button></>}>
      <input className="field" autoFocus placeholder="Its name" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) make(); }} />
      <div className="chips" style={{ marginTop: 14 }}>
        {[['YOUTUBE_MUSIC', 'YouTube Music'], ['SOUNDCLOUD', 'SoundCloud'], ['LOCAL', 'This computer only']].map(([id, label]) => (
          <button key={id} className={`chip ${where === id ? 'on' : ''}`} onClick={() => setWhere(id)}>{label}</button>
        ))}
      </div>
      {where !== 'LOCAL' && (
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, color: 'var(--subtext)' }}>
          <input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} /> Anyone can see it
        </label>
      )}
    </Dialog>
  );
}

/** A playlist on a service, opened: its tracks, and everything that can be done to it there. */
export function PlaylistPage() {
  const route = useRoute();
  const library = usePart('library');
  const key = route.arg ?? '';
  const open = library?.open?.key === key ? library.open : undefined;
  const listed = library?.playlists.find((p) => p.key === key);

  useEffect(() => {
    if (key && library?.open?.key !== key) send('openPlaylist', { key });
  }, [key]);

  const playlist = open ?? listed;
  if (!playlist) return library?.openLoading ? <div style={{ padding: 60, display: 'grid', placeItems: 'center' }}><Spinner /></div> : <Empty icon={<LibraryIcon size={44} />} title="This playlist is not open">It may have been deleted, or the library is still loading.</Empty>;
  const tracks = open?.tracks ?? [];
  const kind = playlistKind(playlist);
  return (
    <>
      <div className="hero">
        <Cover url={bigArtwork(playlist.artworkUrl ?? tracks[0]?.artworkUrl)} />
        <div style={{ minWidth: 0 }}>
          <div className="kind">{kind}</div>
          <h1>{playlist.title}</h1>
          <div className="meta">
            <Badge provider={playlist.provider} />
            {playlist.ownerName && <span>{playlist.ownerName}</span>}
            <span>· {plural(playlist.trackCount ?? tracks.length, 'track')}</span>
            {tracks.length > 0 && <span>· {totalTime(tracks)}</span>}
            {playlist.isPublic != null && <span>· {playlist.isPublic ? <><Globe size={13} /> Public</> : <><Lock size={13} /> Private</>}</span>}
          </div>
        </div>
      </div>
      <div className="toolbar">
        <button className="play-fab" aria-label="Play" onClick={() => send('playPlaylist', { key: playlist.key })}><Play size={24} fill="currentColor" /></button>
        <button className="button" onClick={() => send('playPlaylist', { key: playlist.key, shuffle: true })}><Shuffle size={16} /> Shuffle</button>
        {/* Bandcamp's and VK's songs are for listening here, and their pages are where they live; see keepsFiles. */}
        {!HOSTED && keepsFiles(playlist.provider) && (
          <button className="button" disabled={!tracks.some(canKeep)} onClick={() => send('download', { tracks: tracks.filter(canKeep) })}><Download size={16} /> Download</button>
        )}
        {!keepsFiles(playlist.provider) && playlist.sourceUrl && (
          <button className="button" onClick={() => window.open(playlist.sourceUrl, '_blank', 'noopener')}>
            <ExternalLink size={16} /> {playlist.provider === 'BANDCAMP' && (kind === 'Album' || kind === 'Single') ? 'Buy it on Bandcamp' : `On ${providerName[playlist.provider]}`}
          </button>
        )}
        {HOSTED && (library?.playlists.some((p) => p.key === playlist.key)
          ? <button className="button" onClick={() => send('unsavePlaylist', { key: playlist.key })}><BookmarkCheck size={16} /> In your library</button>
          : <button className="button" disabled={!open} onClick={() => send('savePlaylist', { playlist: open })}><BookmarkPlus size={16} /> Save to your library</button>)}
        {playlist.editable && (
          <>
            <button className="button" onClick={() => openDialog(<Prompt title="Rename" hint={`Renamed on ${providerName[playlist.provider]} too.`} initial={playlist.title} submit={(title) => send('renamePlaylist', { key: playlist.key, title })} />)}><Pencil size={16} /> Rename</button>
            <button className="button" onClick={() => send('visibility', { key: playlist.key, public: playlist.isPublic !== true })}>
              {playlist.isPublic ? <><Lock size={16} /> Make private</> : <><Globe size={16} /> Make public</>}
            </button>
            <button className="button danger" onClick={() => openDialog(<Confirm title={`Delete “${playlist.title}”?`} detail={`It is deleted from ${providerName[playlist.provider]}, not only from here.`} action="Delete" danger yes={() => { send('deletePlaylist', { key: playlist.key }); go('/library'); }} />)}><Trash2 size={16} /> Delete</button>
          </>
        )}
        {(library?.openLoading || library?.enriching) && <Spinner />}
      </div>
      {library?.openError && <div className="banner">{library.openError}</div>}
      <TrackList tracks={tracks} context={{ kind: 'playlist', playlist: open ?? playlist }} />
    </>
  );
}

/** A playlist kept on the computer. */
export function LocalPage() {
  const route = useRoute();
  const library = usePart('library');
  const id = route.arg ?? '';
  const playlist = library?.local.find((p) => p.id === id);
  if (!playlist) return <Empty icon={<LibraryIcon size={44} />} title="No such playlist" />;
  return (
    <>
      <div className="hero">
        <Cover url={bigArtwork(playlist.artworkUrl)} />
        <div style={{ minWidth: 0 }}>
          <div className="kind">{HOSTED ? (id === 'liked' ? 'Your likes' : 'Playlist') : 'On the computer'}</div>
          <h1>{playlist.title}</h1>
          <div className="meta"><span>{plural(playlist.tracks.length, 'track')}</span>{playlist.tracks.length > 0 && <span>· {totalTime(playlist.tracks)}</span>}</div>
        </div>
      </div>
      <div className="toolbar">
        <button className="play-fab" aria-label="Play" disabled={!playlist.tracks.length} onClick={() => send('playLocal', { id })}><Play size={24} fill="currentColor" /></button>
        <button className="button" onClick={() => send('playLocal', { id, shuffle: true })}><Shuffle size={16} /> Shuffle</button>
        {id !== 'liked' && (
          <>
            <button className="button" onClick={() => openDialog(<Prompt title="Rename" initial={playlist.title} submit={(title) => send('renamePlaylist', { localId: id, title })} />)}><Pencil size={16} /> Rename</button>
            <button className="button danger" onClick={() => openDialog(<Confirm title={`Delete “${playlist.title}”?`} action="Delete" danger yes={() => { send('deletePlaylist', { localId: id }); go('/library'); }} />)}><Trash2 size={16} /> Delete</button>
          </>
        )}
      </div>
      {playlist.tracks.length ? <TrackList tracks={playlist.tracks} context={{ kind: 'local', playlist }} /> : <Empty icon={<Plus size={40} />} title="Nothing in it yet">{id === 'liked' ? 'The heart on any track puts it here.' : 'Add tracks from any list with the ⋯ menu.'}</Empty>}
    </>
  );
}
