declare const __HOSTED__: boolean;

/**
 * True in the hosted player's build (`vite build --mode hosted`, for the page on Vercel), false in the one
 * `noctorium web` serves from a computer. It is a constant the build writes in, so the hosted parts are left
 * out of the second build altogether.
 */
export const HOSTED: boolean = __HOSTED__;
