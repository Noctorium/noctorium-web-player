import type { Provider, Settings } from '../types';

/*
 * Which services are still in beta, and what every player says above their sign-in or setup: Base's
 * ProviderType.inBeta and BETA_WARNING in domain/Models.kt, word for word. Noctorium sends its own with the settings,
 * which are used first; this stands in for a Noctorium from before the warning, which sends none.
 *
 * YouTube Music, YouTube and SoundCloud are what Noctorium was built around, and music on this computer or in this
 * browser has no service to fall out with. Everything else is reached in a way its service did not make for
 * Noctorium, and any of them can stop working, or take a dim view of an account it sees used like this.
 */

/** What every player says above the sign-in or setup of a service in beta. */
export const BETA_WARNING =
  'In beta: this service may not work as it should, and there is a small chance it gets your account blocked. ' +
  'Use it at your own risk.';

/** Whether connecting [provider] is still in beta. */
export function inBeta(provider: Provider): boolean {
  switch (provider) {
    case 'YOUTUBE_MUSIC': case 'YOUTUBE_VIDEO': case 'SOUNDCLOUD': case 'LOCAL': return false;
    case 'SPOTIFY': case 'BANDCAMP': case 'VK': case 'APPLE_MUSIC': case 'DEEZER': case 'TIDAL': return true;
  }
}

/** What goes above [provider]'s sign-in in Settings: Noctorium's words, or Base's where it sent none; none out of beta. */
export function betaWarning(provider: Provider, settings?: Pick<Settings, 'betaWarnings'>): string | undefined {
  if (settings?.betaWarnings) return settings.betaWarnings[provider];
  return inBeta(provider) ? BETA_WARNING : undefined;
}
