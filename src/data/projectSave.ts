// Saving a config editor page's file into the repo, through the dev
// server's save endpoint (vite/saveConfigs.ts). Only `npm run dev` has the
// endpoint; elsewhere pages save to browser storage instead.

import { SAVE_CONFIG_HEADER, SAVE_CONFIG_PATH } from './configSaveApi.ts';

// Whether this is the dev server, which can write the repo's data files.
export const CAN_SAVE_TO_PROJECT: boolean = import.meta.env.DEV;

// Sends config `id`'s file text to be saved. Resolves to null once it's
// written, or to why it wasn't (the parser's message for a bad file).
export async function saveConfigToProject(
  id: string,
  text: string,
  send: typeof fetch = (...args) => fetch(...args),
): Promise<string | null> {
  let response: Response;
  try {
    response = await send(`${SAVE_CONFIG_PATH}${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SAVE_CONFIG_HEADER]: '1' },
      body: text,
    });
  } catch (error) {
    return `Couldn't reach the dev server: ${(error as Error).message}`;
  }
  const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (response.ok && body?.ok) return null;
  return body?.error ?? `The dev server answered ${response.status}`;
}
