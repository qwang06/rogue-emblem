import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store.js';

describe('createStore', () => {
  it('returns the initial state', () => {
    const store = createStore({ a: 1 });
    expect(store.getState()).toEqual({ a: 1 });
  });

  it('shallow merges a partial update into a new object', () => {
    const initial = { a: 1, b: 2 };
    const store = createStore(initial);
    store.setState({ b: 3 });
    expect(store.getState()).toEqual({ a: 1, b: 3 });
    expect(store.getState()).not.toBe(initial);
    expect(initial).toEqual({ a: 1, b: 2 });
  });

  it('accepts an updater function', () => {
    const store = createStore({ count: 1 });
    store.setState((s) => ({ count: s.count + 1 }));
    expect(store.getState().count).toBe(2);
  });

  it('notifies subscribers with the new state', () => {
    const store = createStore({ a: 1 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ a: 2 });
    expect(listener).toHaveBeenCalledWith({ a: 2 });
  });

  it('does not notify or replace state when nothing changed', () => {
    const store = createStore({ a: 1 });
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ a: 1 });
    store.setState({});
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });

  it('treats a new key as a change', () => {
    const store = createStore({});
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ a: undefined });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ a: 1 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setState({ a: 2 });
    expect(listener).not.toHaveBeenCalled();
  });
});
