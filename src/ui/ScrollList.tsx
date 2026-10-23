import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { scrollCues, scrollTopToReveal, type ScrollCues } from './listScroll.ts';

// A list that scrolls inside its fixed height: it keeps the row at
// `selectedIndex` in view as the cursor moves, and hangs arrows on its top
// and bottom edges while rows are hidden there. The arrows overlay the
// frame, so their coming and going never moves a row. The list's height
// comes from `className`.
export function ScrollList({
  className,
  selectedIndex,
  children,
}: {
  className: string;
  selectedIndex: number;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [cues, setCues] = useState<ScrollCues>({ above: false, below: false });

  const updateCues = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const next = scrollCues(list.scrollTop, list.clientHeight, list.scrollHeight);
    setCues((prev) => (prev.above === next.above && prev.below === next.below ? prev : next));
  }, []);

  // Scrolls the list itself rather than calling scrollIntoView, which would
  // also scroll the screen around it.
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.children[selectedIndex];
    if (list && row instanceof HTMLElement) {
      list.scrollTop = scrollTopToReveal(
        row.offsetTop,
        row.offsetTop + row.offsetHeight,
        list.scrollTop,
        list.clientHeight,
      );
    }
    updateCues();
  });

  // The window's height changes with the stage (rows are sized in rem).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateCues);
    observer.observe(list);
    return () => observer.disconnect();
  }, [updateCues]);

  return (
    <div className="scroll-list">
      <ul ref={listRef} className={`scroll-list__list ${className}`} onScroll={updateCues}>
        {children}
      </ul>
      {cues.above && <span className="scroll-list__cue scroll-list__cue--above" aria-hidden="true" />}
      {cues.below && <span className="scroll-list__cue scroll-list__cue--below" aria-hidden="true" />}
    </div>
  );
}
