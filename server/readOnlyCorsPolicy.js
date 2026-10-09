// Deliberately narrow origin policy for GET-only Upstox paper research APIs.
// Do not add wildcard origins or enable cross-origin cookies/credentials.
export const READ_ONLY_CLIENT_ORIGINS=Object.freeze([
 'https://revspharma10-boop.github.io',
 'https://localhost' // Capacitor Android WebView with androidScheme=https
]);
export function allowedReadOnlyClientOrigin(origin){
 return typeof origin==='string'&&READ_ONLY_CLIENT_ORIGINS.includes(origin)?origin:null;
}
export function readOnlyCorsHeaders(origin){
 const approved=allowedReadOnlyClientOrigin(origin);
 return approved?{'Access-Control-Allow-Origin':approved,'Vary':'Origin'}:{'Vary':'Origin'};
}
