import { useState } from 'react';
import { customDialogStore } from '../data/customDialogs.ts';
import { CHARACTERS, DIALOG_TEXTS, DIALOGS } from '../data/dialogs.ts';
import { applyCustomDialogs, checkDialogUpload, compareTriggers } from '../game/dialogUploads.ts';
import { ConfigLayout } from './ConfigLayout.tsx';
import { routeHash } from './route.ts';
import { downloadText, STORAGE_UNAVAILABLE, UploadDrop, type UploadNotice } from './UploadDrop.tsx';

const DIALOG_NAMES = Object.keys(DIALOGS).sort();

// #/configs/dialogs: upload .txt dialog files to replace a level's built-in
// conversations. Each upload is checked like a built-in file before it's
// kept (in this browser's storage, see src/data/customDialogs.ts), and the
// next battle plays it. Every file can be downloaded (the built-in one is a
// starting point to edit) or reset to the built-in version.
export function DialogConfigPage() {
  const [custom, setCustom] = useState(() => customDialogStore.load());
  const [notices, setNotices] = useState<readonly UploadNotice[]>([]);

  const { files, errors } = applyCustomDialogs(DIALOGS, custom, CHARACTERS);

  async function upload(fileList: File[]) {
    const results: UploadNotice[] = [];
    for (const file of fileList) {
      const result = checkDialogUpload(file.name, await file.text(), CHARACTERS, DIALOG_NAMES);
      if (!result.ok) {
        results.push({ fileName: file.name, ok: false, message: result.error });
      } else if (!customDialogStore.save(result.name, result.text)) {
        results.push({ fileName: file.name, ok: false, message: STORAGE_UNAVAILABLE });
      } else {
        const count = Object.keys(result.scripts).length;
        results.push({
          fileName: file.name,
          ok: true,
          message: `Replaces ${result.name}.txt (${count} conversation${count === 1 ? '' : 's'})`,
        });
      }
    }
    setNotices(results);
    setCustom(customDialogStore.load());
  }

  function reset(name: string) {
    if (!window.confirm(`Remove your uploaded ${name}.txt and go back to the built-in dialog?`)) return;
    customDialogStore.remove(name);
    setCustom(customDialogStore.load());
    setNotices([]);
  }

  return (
    <ConfigLayout
      title="Dialogs"
      lede="Upload your own dialog files to replace a level's conversations. Changes apply to the next battle you start."
      back={{ href: routeHash({ page: 'configs' }), label: 'All Configs' }}
    >
      <section className="configs-group">
        <UploadDrop
          accept=".txt,text/plain"
          multiple
          title="Drop dialog files here, or click to choose"
          hint={`Name each file after the dialog it replaces: ${DIALOG_NAMES.map((name) => `${name}.txt`).join(', ')}`}
          notices={notices}
          onFiles={(fileList) => void upload(fileList)}
        />

        <details className="dialog-format">
          <summary>File format</summary>
          <pre>{`# Comments start with #. Blank lines are ignored.

[opening]
alden: Enemy soldiers have taken the old gate.
enemy_soldier: Hold the line!
bryn (right): Add (left) or (right) to put a speaker on the other side.

[turn 2]
cato: Sections are opening, turn N, victory and defeat.`}</pre>
          <p>Speakers are character ids: {Object.keys(CHARACTERS).join(', ')}.</p>
        </details>
      </section>

      <section className="configs-group" aria-labelledby="dialog-files-title">
        <h2 id="dialog-files-title" className="configs-group__title">
          Dialog Files
        </h2>
        <ul className="dialog-files">
          {DIALOG_NAMES.map((name) => {
            const uploaded = name in custom;
            const active = uploaded && !errors[name];
            const scripts = files[name];
            const triggers = Object.keys(scripts).sort(compareTriggers);
            return (
              <li key={name} className="config-card">
                <div className="config-card__head">
                  <h3 className="config-card__title">{name}.txt</h3>
                  <span className={active ? 'config-card__badge config-card__badge--ready' : 'config-card__badge'}>
                    {active ? 'Uploaded' : 'Built-in'}
                  </span>
                </div>
                {uploaded && errors[name] && (
                  <p className="upload-notice upload-notice--error">
                    Your upload no longer loads, so the built-in file plays: {errors[name]}
                  </p>
                )}
                {triggers.length === 0 ? (
                  <p className="config-card__description">No conversations.</p>
                ) : (
                  <ul className="dialog-triggers">
                    {triggers.map((trigger) => (
                      <li key={trigger}>
                        <details>
                          <summary>
                            <span className="dialog-triggers__name">[{trigger}]</span>{' '}
                            <span className="dialog-triggers__count">
                              {scripts[trigger].length} line{scripts[trigger].length === 1 ? '' : 's'}
                            </span>
                          </summary>
                          <ol className="dialog-lines">
                            {scripts[trigger].map((line, i) => (
                              <li key={i} className={`dialog-lines__line dialog-lines__line--${line.side}`}>
                                <span className={`dialog-lines__speaker dialog-lines__speaker--${line.team}`}>
                                  {line.speaker}
                                </span>{' '}
                                {line.text}
                              </li>
                            ))}
                          </ol>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="dialog-files__actions">
                  <button
                    type="button"
                    className="header-button"
                    onClick={() => downloadText(`${name}.txt`, uploaded ? custom[name] : DIALOG_TEXTS[name])}
                  >
                    Download
                  </button>
                  {uploaded && (
                    <button type="button" className="header-button" onClick={() => reset(name)}>
                      Reset to Built-in
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </ConfigLayout>
  );
}
