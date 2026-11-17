// Sessions use a package-scoped URL, including development. An installed older
// service worker must not supply stale unversioned runtime modules to the dev UI.
import {version,labosRelease} from '../../package.json';
export const APP_VERSION = typeof __APP_VERSION__ === 'undefined' ? version : __APP_VERSION__;
export const APP_STAGE=labosRelease.stage;
export const APP_RELEASE_TITLE=labosRelease.title;
export const APP_BUILD = typeof __APP_BUILD__ === 'undefined' ? 'development' : __APP_BUILD__;
export const APP_BASE = typeof __APP_BASE__ === 'undefined' ? '/' : __APP_BASE__;
export const appAsset = (path: string) => `${APP_BASE}${path.replace(/^\//, '')}`;
export const runtimeAsset = (path: string) => appAsset(`app/${APP_BUILD}/${path}`);
