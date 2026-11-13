import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { i18n, useT } from '../../lib/i18n';
import './RunScene.css';

type ChoiceId = 'board' | 'wait';

/**
 * Static choice → outcome lookup. Determinism (R1 spec §7): the mapping is a
 * fixed table, never sampled or computed, so a given choice always renders the
 * same outcome in every render, session and locale.
 */
const CHOICES: ReadonlyArray<{ id: ChoiceId; labelKey: string; outcomeKey: string }> = [
  { id: 'board', labelKey: 'run_scene.choice_board', outcomeKey: 'run_scene.outcome_board' },
  { id: 'wait', labelKey: 'run_scene.choice_wait', outcomeKey: 'run_scene.outcome_wait' },
];

interface RunSceneProps {
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled])';

/**
 * The Last Bus — one optional post-Run scene (R1).
 *
 * Mounted by Dashboard once per page session, at the end of the existing run
 * animation window. Holds no persisted state: everything here is component
 * state, discarded when the scene closes (`useState` only, no persistence).
 */
export const RunScene = ({ onClose }: RunSceneProps) => {
  useT();
  const [chosen, setChosen] = useState<ChoiceId | null>(null);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const choice = chosen ? CHOICES.find((c) => c.id === chosen) ?? null : null;

  // AC-A3: initial focus lands on the first choice button, not the container.
  useEffect(() => {
    firstChoiceRef.current?.focus();
  }, []);

  // After a choice the buttons are replaced; keep focus inside the dialog by
  // handing it to the only remaining control.
  useEffect(() => {
    if (chosen) closeRef.current?.focus();
  }, [chosen]);

  const handleTabKey = useCallback((event: KeyboardEvent) => {
    const root = dialogRef.current;
    if (!root) return;

    const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = active !== null && root.contains(active);

    // AC-A4: focus can never leave the dialog while it is open.
    if (!inside) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    }
  }, []);

  // AC-A5 / AC-A4: Escape closes from either state; Tab is contained.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') handleTabKey(event);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleTabKey, onClose]);

  return (
    <div className="run-scene-overlay">
      <div
        ref={dialogRef}
        className="run-scene-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 className="run-scene-title" id={titleId}>
          {i18n.t('run_scene.title')}
        </h2>
        <p className="run-scene-body">{i18n.t('run_scene.body')}</p>

        {choice ? (
          <>
            <p className="run-scene-outcome" role="status">
              {i18n.t(choice.outcomeKey)}
            </p>
            <div className="run-scene-actions">
              <button type="button" ref={closeRef} className="run-scene-close" onClick={onClose}>
                {i18n.t('run_scene.close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="run-scene-choices">
              {CHOICES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  ref={index === 0 ? firstChoiceRef : undefined}
                  className="run-scene-choice"
                  onClick={() => setChosen(item.id)}
                >
                  {i18n.t(item.labelKey)}
                </button>
              ))}
            </div>
            <div className="run-scene-actions">
              <button type="button" className="run-scene-skip" onClick={onClose}>
                {i18n.t('run_scene.skip')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
