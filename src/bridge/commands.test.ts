import { describe, expect, it, vi } from 'vitest';
import { createCommandChannel } from './commands.ts';

describe('createCommandChannel', () => {
  it('delivers sent commands to every subscriber', () => {
    const channel = createCommandChannel();
    const a = vi.fn();
    const b = vi.fn();
    channel.subscribe(a);
    channel.subscribe(b);
    channel.send({ type: 'confirm' });
    expect(a).toHaveBeenCalledWith({ type: 'confirm' });
    expect(b).toHaveBeenCalledWith({ type: 'confirm' });
  });

  it('does nothing when no one is listening', () => {
    const channel = createCommandChannel();
    expect(() => channel.send({ type: 'cancel' })).not.toThrow();
  });

  it('stops delivering after unsubscribe', () => {
    const channel = createCommandChannel();
    const handler = vi.fn();
    const unsubscribe = channel.subscribe(handler);
    unsubscribe();
    channel.send({ type: 'confirm' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps channels independent', () => {
    const one = createCommandChannel();
    const two = createCommandChannel();
    const handler = vi.fn();
    one.subscribe(handler);
    two.send({ type: 'confirm' });
    expect(handler).not.toHaveBeenCalled();
  });
});
