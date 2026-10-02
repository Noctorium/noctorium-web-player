<div align="center">

<img src="public/noctorium.png" width="96" alt="Noctorium">

# Noctorium web player

**Noctorium in a browser.**

</div>

The page [`noctorium web`](https://github.com/Noctorium/Noctorium-cli) serves to the phones, tablets and
computers in the house: home, search and your library from YouTube Music and SoundCloud, one queue,
synced lyrics, playlists you can edit, likes that go to the real account, every Noctorium theme. The music
plays out of whatever device has the page open — with its lock-screen controls on a phone — or out of the
computer running Noctorium, with the page as a remote.

## How it works

There is no hosted Noctorium web service, on purpose. The page talks only to the Noctorium that served it,
over one WebSocket:

- **The state comes in parts** — playback, queue, home, search, library, likes, lyrics, settings, downloads,
  Connect — each sent again only when it changes. `src/types.ts` mirrors `Wire.kt` in Noctorium-cli.
- **Commands go out** — `{ type: 'play', track, list }`, `{ type: 'like', track }`, and so on — each the
  call the desktop's own button makes, answered by id.
- **Audio instructions come in** when this tab is the speaker: load this address, play, pause, seek. The
  address is Noctorium's own, which fetches the service's audio for the browser; HLS goes through hls.js.
  The audio element reports back, so the queue moves on and listens are counted exactly as on the desktop.

Getting in takes the key in the link `noctorium web` prints, swapped for a cookie on the first visit.

## Working on it

```bash
npm install
noctorium web --no-open        # a real Noctorium for the page to talk to, on :7300
npm run dev                    # the page on :5173, with /api passed through to it
```

Open the `?key=` link once on :7300 so the browser has the cookie, then work on :5173.
`npm run build` writes `dist/`, which Noctorium-cli's build carries inside its jar.

---

<sub>Free software under the GPL-3.0. Not affiliated with Google, YouTube, SoundCloud, Spotify, Last.fm,
ListenBrainz or Discord.</sub>
