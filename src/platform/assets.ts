// Sessions use a package-scoped URL, including development. An installed older
// service worker must not supply stale unversioned runtime modules to the dev UI.
export const APP_VERSION = typeof __APP_VERSION__ === 'undefined' ? '0.7.1-beta.1' : __APP_VERSION__;
export const APP_BUILD = typeof __APP_BUILD__ === 'undefined' ? 'development' : __APP_BUILD__;
export const APP_BASE = typeof __APP_BASE__ === 'undefined' ? '/' : __APP_BASE__;
export const appAsset = (path: string) => `${APP_BASE}${path.replace(/^\//, '')}`;
export const runtimeAsset = (path: string) => appAsset(`app/${APP_BUILD}/${path}`);
