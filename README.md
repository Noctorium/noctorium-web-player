<div align="center">

<img src="public/noctorium.png" width="96" alt="Noctorium">

# Noctorium web player

**Noctorium in a browser.**

[Open it](https://noctorium-music.vercel.app) · [Noctorium](https://noctorium.vercel.app)

</div>

One page, built two ways:

- **The hosted player** at [noctorium-music.vercel.app](https://noctorium-music.vercel.app): open it and play.
  YouTube Music and SoundCloud in one search, one queue and one player, synced lyrics, every Noctorium
  theme. No account to make, and none of yours to sign in to: likes, playlists and pins are kept in the
  browser, and can be saved as a file and opened in another.
- **The page [`noctorium web`](https://github.com/Noctorium/Noctorium-cli) serves** to the phones, tablets and
  computers in the house, from a Noctorium on your own computer: the same screens, with your own accounts
  behind them — likes and playlists that go to the real account, downloads, the computer's speakers,
  Connect.

## The hosted player

Nothing of the music passes through the server. What it does is answer the questions a page on another site
cannot ask the services itself, because neither answers another site's page: `api/music.ts`, one Vercel
function, searches, reads playlists, albums, the home page and radios, and finds where a SoundCloud track's
audio is. It answers in the page's own shapes (`src/types.ts`) and is cached at the edge.

- **SoundCloud** plays in the page's audio element, straight from SoundCloud's servers, which answer any page.
  Plain MP3 where it is offered, its HLS streams through hls.js otherwise.
- **YouTube and YouTube Music** play in YouTube's own embedded player, the way YouTube offers other sites to
  play its videos — from the listener's own connection, under YouTube's terms. Those ask that the player be
  shown, at least 200 by 200, so it is: where the cover would be on the now playing screen, and a card in the
  corner otherwise. A server fetching YouTube's audio for the page would break those terms, and a data
  centre is blocked from it anyway.
- **The rest happens in the browser.** `src/hosted/engine.ts` takes the same commands `noctorium web` does and
  sends back the same parts of the state, so every screen is the same screen: the queue, shuffle and repeat,
  the sleep timer, carrying on with similar songs when the queue runs out, lyrics from LRCLIB, Karalyr and
  lyrics.ovh, ListenBrainz.

Signed-in features stay with the apps on purpose: signing in to Google or SoundCloud only works on their own
pages, inside an app, and a session handed to a website would be a session handed to a stranger.

## `noctorium web`

The page talks only to the Noctorium that served it, over one WebSocket:

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

The hosted player is `npm run build:hosted` (the same page with `src/hosted/` built in, and the rest of
`noctorium web`'s connection left out), and `npm run dev:hosted` with `vercel dev` on :3000 for the API. It is
deployed with `vercel deploy --prod`.

---

<sub>Free software under the GPL-3.0. Not affiliated with Google, YouTube, SoundCloud, Spotify, Last.fm,
ListenBrainz or Discord.</sub>
