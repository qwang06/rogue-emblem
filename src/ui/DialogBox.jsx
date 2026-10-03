import { useEffect, useState } from 'react';
import { SPRITE_URLS } from '../assets/sprites.js';
import { gameCommands } from '../bridge/commands.js';
import { getRevealedLength } from '../game/dialog.ts';
import { UnitSprite } from './UnitSprite.jsx';
import { useGameStore } from './useGameStore.js';

// The conversation box along the bottom of the map: the speaker's portrait
// on their side, a name plate, and the line typing out. GridScene handles
// the input (confirm finishes the line or moves on, cancel skips); a click
// anywhere on the map confirms.
export function DialogBox() {
  const line = useGameStore((state) => state.dialog);
  if (!line) return null;

  return (
    <div className="dialog-layer" onClick={() => gameCommands.send({ type: 'confirm' })}>
      <section className={`panel dialog-box dialog-box--${line.side}`} aria-label="Dialog">
        <DialogPortrait portrait={line.portrait} sprite={line.sprite} />
        <div className="dialog-box__body">
          {line.speaker && <h2 className="dialog-box__speaker">{line.speaker}</h2>}
          {/* Keyed by line so the typing restarts for each one. */}
          <TypedText key={line.id} text={line.text} revealed={line.revealed} charsPerSecond={line.charsPerSecond} />
        </div>
      </section>
    </div>
  );
}

// The frame a character's portrait goes in: their portrait art (the
// `portrait` sprite key from characters.json) when they have some, else
// their unit sprite scaled up to fill it.
function DialogPortrait({ portrait, sprite }) {
  const portraitUrl = portrait ? SPRITE_URLS[portrait] : null;
  return (
    <div className="dialog-box__portrait" aria-hidden="true">
      {portraitUrl ? (
        <img className="dialog-box__portrait-art" src={portraitUrl} alt="" />
      ) : (
        sprite && <UnitSprite sprite={sprite} scale={3} animated />
      )}
    </div>
  );
}

// Types `text` out at `charsPerSecond`, or shows it all once `revealed`.
// The untyped rest is laid out but invisible, so the box doesn't reflow as
// the line grows. A marker blinks once the line is fully shown.
function TypedText({ text, revealed, charsPerSecond }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (revealed) return undefined;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const length = getRevealedLength(text, now - start, charsPerSecond);
      setShown(length);
      if (length < text.length) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [text, revealed, charsPerSecond]);

  const length = revealed ? text.length : shown;
  const done = length >= text.length;
  return (
    // Screen readers get the whole line at once rather than every letter.
    <p className="dialog-box__text" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, length)}</span>
      <span className="dialog-box__untyped" aria-hidden="true">
        {text.slice(length)}
      </span>
      {done && <span className="dialog-box__next" aria-hidden="true" />}
    </p>
  );
}
