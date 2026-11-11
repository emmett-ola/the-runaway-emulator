import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunScene } from '../components/RunScene';
import { Dashboard } from '../components/Dashboard';
import { i18n } from '../i18n/i18n';

// Records every saveUserData argument so T6 can prove no scene field is ever
// handed to the persistence layer (vi.hoisted: visible inside the mock factory).
const { saveUserDataCalls } = vi.hoisted(() => ({ saveUserDataCalls: [] as unknown[] }));

vi.mock('../storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage')>();
  return {
    ...actual,
    saveUserData: (...args: Parameters<typeof actual.saveUserData>) => {
      saveUserDataCalls.push(args[0]);
      return actual.saveUserData(...args);
    },
  };
});

const SCENE_KEYS = [
  'title',
  'body',
  'choice_board',
  'choice_wait',
  'outcome_board',
  'outcome_wait',
  'skip',
  'close',
] as const;

const t = (key: string) => i18n.t(key);

const renderScene = () => {
  const onClose = vi.fn();
  const utils = render(<RunScene onClose={onClose} />);
  return { onClose, ...utils };
};

/** Waits for the R1 scene to mount after a Run (600 ms window + async hit). */
const findDialog = () => screen.findByRole('dialog', {}, { timeout: 4000 });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  saveUserDataCalls.length = 0;
  i18n.setLanguage('en_us');
  // Keep the 0.6% boom easter egg and the Fork index randomisation out of the
  // way so Dashboard-level assertions are deterministic.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RunScene — dialog contract', () => {
  it('exposes role=dialog, aria-modal and a resolvable accessible name (AC-A1, AC-A2)', () => {
    renderScene();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)).toHaveTextContent(t('run_scene.title'));
    // The id is generated, not a fixed literal.
    expect(labelledBy).toMatch(/\S+/);
  });

  it('renders title, body, choices then Skip in that reading order (AC-A8)', () => {
    renderScene();

    const dialog = screen.getByRole('dialog');
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual([
      t('run_scene.choice_board'),
      t('run_scene.choice_wait'),
      t('run_scene.skip'),
    ]);

    const text = dialog.textContent ?? '';
    expect(text.indexOf(t('run_scene.title'))).toBeLessThan(text.indexOf(t('run_scene.body')));
    expect(text.indexOf(t('run_scene.body'))).toBeLessThan(
      text.indexOf(t('run_scene.choice_board')),
    );
    expect(text.indexOf(t('run_scene.choice_wait'))).toBeLessThan(text.indexOf(t('run_scene.skip')));
  });

  it('uses native, keyboard-operable buttons for every control (AC-A9)', () => {
    renderScene();

    for (const button of screen.getAllByRole('button')) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toBeEnabled();
    }
  });
});

describe('RunScene — determinism (T1, T2, T3)', () => {
  it('T1: choice A always renders the exact outcome_board string, across repeated mounts', () => {
    const results: string[] = [];

    for (let i = 0; i < 3; i += 1) {
      const { unmount } = renderScene();
      act(() => {
        screen.getByRole('button', { name: t('run_scene.choice_board') }).click();
      });
      results.push(screen.getByText(t('run_scene.outcome_board')).textContent ?? '');
      unmount();
    }

    expect(results).toHaveLength(3);
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(t('run_scene.outcome_board'));
  });

  it('T2: choice B renders outcome_wait and never leaks outcome_board', () => {
    renderScene();

    act(() => {
      screen.getByRole('button', { name: t('run_scene.choice_wait') }).click();
    });

    expect(screen.getByText(t('run_scene.outcome_wait'))).toBeInTheDocument();
    expect(screen.queryByText(t('run_scene.outcome_board'))).not.toBeInTheDocument();
  });

  it('T3: choosing consumes both choice buttons in that instance', () => {
    renderScene();

    act(() => {
      screen.getByRole('button', { name: t('run_scene.choice_board') }).click();
    });

    expect(screen.queryByRole('button', { name: t('run_scene.choice_board') })).toBeNull();
    expect(screen.queryByRole('button', { name: t('run_scene.choice_wait') })).toBeNull();
    // Only Close (and no Skip) remains once an outcome is shown.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: t('run_scene.close') })).toBeInTheDocument();
  });
});

describe('RunScene — exits (T4, T5)', () => {
  it('T4: Skip calls onClose exactly once, shows no outcome and removes the dialog', () => {
    const { onClose, unmount } = renderScene();

    act(() => {
      screen.getByRole('button', { name: t('run_scene.skip') }).click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(t('run_scene.outcome_board'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('run_scene.outcome_wait'))).not.toBeInTheDocument();
    unmount();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('T5: Escape closes from the choices state', () => {
    const { onClose } = renderScene();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('T5: Escape closes from the outcome state', () => {
    const { onClose } = renderScene();

    act(() => {
      screen.getByRole('button', { name: t('run_scene.choice_wait') }).click();
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Close dismisses the outcome (the same onClose path)', () => {
    const { onClose } = renderScene();

    act(() => {
      screen.getByRole('button', { name: t('run_scene.choice_board') }).click();
    });
    act(() => {
      screen.getByRole('button', { name: t('run_scene.close') }).click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RunScene — focus contract (T9, AC-A3, AC-A4)', () => {
  it('T9: initial focus is the first choice button', () => {
    renderScene();

    expect(screen.getByRole('button', { name: t('run_scene.choice_board') })).toHaveFocus();
    expect(screen.getByRole('dialog')).not.toHaveFocus();
  });

  it('T9: Tab from the last control wraps to the first', async () => {
    const user = userEvent.setup();
    renderScene();

    screen.getByRole('button', { name: t('run_scene.skip') }).focus();
    expect(screen.getByRole('button', { name: t('run_scene.skip') })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: t('run_scene.choice_board') })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: t('run_scene.choice_wait') })).toHaveFocus();
  });

  it('T9: Shift+Tab from the first control wraps to the last', async () => {
    const user = userEvent.setup();
    renderScene();

    expect(screen.getByRole('button', { name: t('run_scene.choice_board') })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: t('run_scene.skip') })).toHaveFocus();
  });

  it('T9: focus stays inside the dialog when it starts outside (containment guard)', async () => {
    const user = userEvent.setup();
    renderScene();

    // Simulate focus escaping the dialog (e.g. a stray programmatic focus).
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    expect(outside).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: t('run_scene.choice_board') })).toHaveFocus();

    outside.remove();
  });

  it('moves focus to Close when the choices are replaced, keeping it in the dialog', () => {
    renderScene();

    act(() => {
      screen.getByRole('button', { name: t('run_scene.choice_wait') }).click();
    });

    expect(screen.getByRole('button', { name: t('run_scene.close') })).toHaveFocus();
  });
});

describe('RunScene — locale coverage (T8)', () => {
  it.each(['en_us', 'zh_cn', 'zh_tw'] as const)('T8: every run_scene key resolves in %s', (lang) => {
    i18n.setLanguage(lang);

    for (const key of SCENE_KEYS) {
      const value = t(`run_scene.${key}`);
      expect(value).not.toBe(`run_scene.${key}`);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('T8: the scene renders translated copy, not key paths', () => {
    i18n.setLanguage('zh_cn');
    renderScene();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('末班车');
    expect(screen.getByText('你赶到街角时，末班车正好进站。车门开着，司机在等你。')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: '上车。' }).click();
    });
    expect(
      screen.getByText('车经过公司门口，没有减速。你没有起身，也没人问你为什么。'),
    ).toBeInTheDocument();
  });
});

describe('Dashboard — scene mounting, once per session, no persistence (T6, T7)', () => {
  const renderDashboard = () =>
    render(<Dashboard username="testuser" onLogout={() => {}} />);

  const pressRun = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /RUN/ }));
  };

  it('T7: the scene opens after the first successful Run and not again in the same session', async () => {
    const { unmount } = renderDashboard();

    await pressRun();
    expect(await findDialog()).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: t('run_scene.skip') }).click();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await pressRun();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 900));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    unmount();
  });

  it('T7: a fresh component tree (as a reload) re-arms the scene', async () => {
    const first = renderDashboard();
    await pressRun();
    expect(await findDialog()).toBeInTheDocument();
    act(() => {
      screen.getByRole('button', { name: t('run_scene.skip') }).click();
    });
    first.unmount();

    renderDashboard();
    await pressRun();
    expect(await findDialog()).toBeInTheDocument();
  });

  it('T6: a full Run → choose → Close cycle writes nothing scene-related', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderDashboard();

    await pressRun();
    await findDialog();
    await user.click(screen.getByRole('button', { name: t('run_scene.choice_board') }));
    await user.click(screen.getByRole('button', { name: t('run_scene.close') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    for (const [key, value] of setItem.mock.calls) {
      expect(String(key).toLowerCase()).not.toContain('scene');
      expect(String(value).toLowerCase()).not.toContain('scene');
      expect(String(value)).not.toContain(t('run_scene.outcome_board'));
      expect(String(value)).not.toContain(t('run_scene.title'));
    }

    // The hit itself is real and persisted by the existing path; nothing else is.
    // `profile` is added by the pre-existing storage layer (registration date),
    // not by R1.
    const stored = JSON.parse(localStorage.getItem('runawaylog-data') ?? '{}');
    expect(stored.testuser.hits).toHaveLength(1);
    const keys = Object.keys(stored.testuser).sort();
    expect(keys).toEqual(['hits', 'profile', 'username']);
    expect(keys.some((key) => /scene/i.test(key))).toBe(false);

    // saveUserData was never handed a scene field (in fact never called here).
    for (const payload of saveUserDataCalls) {
      expect(JSON.stringify(payload)).not.toContain('scene');
    }
  });

  it('restores focus to the Run control after Skip and Escape (AC-A21)', async () => {
    const user = userEvent.setup();
    const first = renderDashboard();

    await pressRun();
    await findDialog();
    await user.click(screen.getByRole('button', { name: t('run_scene.skip') }));
    expect(screen.getByRole('button', { name: /RUN/ })).toHaveFocus();
    expect(screen.getByRole('button', { name: /RUN/ })).toBeEnabled();
    first.unmount();

    // Escape path, fresh session
    renderDashboard();
    await pressRun();
    await findDialog();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /RUN/ })).toHaveFocus();
  });
});
