import { describe, expect, it } from 'vitest';
import { listenUntilStopped, type SceneEvents } from './sceneListeners.ts';

type Listener = (...args: never[]) => void;

// Like Phaser's emitter (eventemitter3): an event calls the listeners it had
// when it was emitted, even ones removed while it runs.
function fakeEvents(): SceneEvents & { emit(event: string, ...args: unknown[]): void; count(event: string): number } {
  const listeners = new Map<string, Listener[]>();
  return {
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    off(event, listener) {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((l) => l !== listener),
      );
    },
    emit(event, ...args) {
      for (const listener of listeners.get(event) ?? []) (listener as (...a: unknown[]) => void)(...args);
    },
    count(event) {
      return (listeners.get(event) ?? []).length;
    },
  };
}

describe('listenUntilStopped', () => {
  it('calls each listener on its event until stopped', () => {
    const events = fakeEvents();
    const calls: string[] = [];
    const stop = listenUntilStopped(events, { update: () => calls.push('update'), render: () => calls.push('render') });
    events.emit('update');
    events.emit('render');
    stop();
    events.emit('update');
    events.emit('render');
    expect(calls).toEqual(['update', 'render']);
    expect(events.count('update')).toBe(0);
    expect(events.count('render')).toBe(0);
  });

  it('does nothing when stopped by an earlier listener of the same event', () => {
    // The freeze after a stage's last kill: a tween on UPDATE destroyed the
    // unit's sprite, and the sprite's own UPDATE listener still ran on it.
    const events = fakeEvents();
    let destroyed = false;
    let stop = () => {};
    events.on('update', () => {
      destroyed = true;
      stop();
    });
    stop = listenUntilStopped(events, {
      update: () => {
        if (destroyed) throw new Error('ran on a destroyed sprite');
      },
    });
    expect(() => events.emit('update')).not.toThrow();
  });

  it('passes the event arguments through', () => {
    const events = fakeEvents();
    const seen: number[][] = [];
    listenUntilStopped(events, { update: (time: number, delta: number) => seen.push([time, delta]) });
    events.emit('update', 100, 16);
    expect(seen).toEqual([[100, 16]]);
  });
});
