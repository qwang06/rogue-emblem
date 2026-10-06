// The dev server's config save endpoint (vite/saveConfigs.ts), as the
// editor (src/data/projectSave.ts) calls it. Nothing else lives here, so
// the Vite config can import it without pulling in browser code.

// Saves are POSTed to this path plus the config's id.
export const SAVE_CONFIG_PATH = '/__configs/';

// Sent with every save. A page on another site can't add a custom header
// without the browser asking the dev server first, and Vite only says yes
// to pages served from this machine, so other sites can't write files.
export const SAVE_CONFIG_HEADER = 'x-rogue-emblem-save';
