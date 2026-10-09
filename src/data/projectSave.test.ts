import { describe, expect, it } from 'vitest';
import { SAVE_CONFIG_HEADER } from './configSaveApi.ts';
import { saveConfigToProject } from './projectSave.ts';

const answer = (status: number, body: unknown) => async () =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('saveConfigToProject', () => {
  it('POSTs the text with the save header and resolves null once saved', async () => {
    const calls: [string, RequestInit][] = [];
    const send = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push([String(url), init!]);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    expect(await saveConfigToProject('regions', '{}', send as typeof fetch)).toBeNull();
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe('/__configs/regions');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    expect((init.headers as Record<string, string>)[SAVE_CONFIG_HEADER]).toBe('1');
  });

  it("gives the server's reason when it turns the file away", async () => {
    const send = answer(400, { ok: false, error: 'regions must be a list' });
    expect(await saveConfigToProject('regions', '{}', send as typeof fetch)).toBe('regions must be a list');
  });

  it('gives the status when the answer has no reason', async () => {
    expect(await saveConfigToProject('x', '{}', answer(500, 'oops') as typeof fetch)).toBe(
      'The dev server answered 500',
    );
  });

  it("says so when the server can't be reached", async () => {
    const send = async () => {
      throw new Error('Failed to fetch');
    };
    expect(await saveConfigToProject('x', '{}', send as typeof fetch)).toBe(
      "Couldn't reach the dev server: Failed to fetch",
    );
  });
});
