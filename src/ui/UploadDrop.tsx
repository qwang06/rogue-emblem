import { useState, type ChangeEvent, type DragEvent } from 'react';

export interface UploadNotice {
  fileName: string;
  ok: boolean;
  message: string;
}

export const STORAGE_UNAVAILABLE = "Couldn't save: this browser's storage is unavailable";

// A config page's file upload: a drop zone that's also a file picker
// (click or keyboard), handing the chosen files to `onFiles`, with the
// last upload's results (`notices`) listed underneath.
export function UploadDrop({
  accept,
  multiple = false,
  title,
  hint,
  notices,
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  title: string;
  hint: string;
  notices: readonly UploadNotice[];
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) onFiles(Array.from(event.target.files));
    event.target.value = ''; // so picking the same file again uploads it again
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <>
      <label
        className={dragging ? 'upload-drop upload-drop--active' : 'upload-drop'}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="upload-drop__input"
          onChange={onInputChange}
        />
        <span className="upload-drop__title">{title}</span>
        <span className="upload-drop__hint">{hint}</span>
      </label>

      <ul className="upload-notices" aria-live="polite">
        {notices.map((notice, i) => (
          <li key={i} className={notice.ok ? 'upload-notice upload-notice--ok' : 'upload-notice upload-notice--error'}>
            <strong>{notice.fileName}</strong> {notice.ok ? '✓' : '✗'} {notice.message}
          </li>
        ))}
      </ul>
    </>
  );
}

// Saves `text` as a file the browser downloads.
export function downloadText(fileName: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
