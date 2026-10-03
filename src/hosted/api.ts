/*
 * The hosted player's own server: one function (api/music.ts) that asks YouTube Music and SoundCloud what a page
 * cannot ask them itself. It answers with lists and addresses, never audio.
 */

const language = (navigator.language || 'en-US').split('-');
const locale = { hl: language[0].toLowerCase(), gl: (language[1] ?? 'US').toUpperCase() };

export async function ask<T>(op: string, parameters: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({ op, ...parameters, ...locale });
  let response: Response;
  try {
    response = await fetch(`/api/music?${query}`);
  } catch {
    throw new Error('Noctorium could not be reached. Is this device online?');
  }
  const body = await response.json().catch(() => ({ error: `The server answered ${response.status}` }));
  if (!response.ok || body.error) throw new Error(body.error ?? `The server answered ${response.status}`);
  return body as T;
}
