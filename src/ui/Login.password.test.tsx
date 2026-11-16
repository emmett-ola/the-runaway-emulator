import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';
import { LoginError } from './LoginPassword';
import { i18n } from '../lib/i18n';
import { login, logout, lookupLocalIdentity, register } from '../auth';
import { appendHit, createAccount, readCredential, readFullRecord, readRecord } from '../lib/storage';
import { getSessionUsername } from '../app/session';

vi.mock('animejs', () => ({ animate: vi.fn() }));
const synthetic = (): string => `SYNTHETIC-UI-${crypto.randomUUID()}`;
const next = async (username: string) => {
  fireEvent.change(screen.getByLabelText(i18n.t('login.username')), { target: { value: username } });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('login.next') }));
  return screen.findByLabelText(i18n.t('login.password'));
};
const fill = (password: string, confirmation = password) => {
  fireEvent.change(screen.getByLabelText(i18n.t('login.password')), { target: { value: password } });
  const confirm = screen.queryByLabelText(i18n.t('login.confirm_password'));
  if (confirm) fireEvent.change(confirm, { target: { value: confirmation } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('login.setup_button') }));
beforeEach(async () => { sessionStorage.clear(); await i18n.setLanguage('en_us'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('username-first local password gate', () => {
  it('shows only username before lookup and validates an empty username locally', () => {
    const onLogin = vi.fn(); render(<Login onLogin={onLogin} />);
    expect(screen.queryByLabelText(i18n.t('login.password'))).toBeNull();
    expect(screen.queryByLabelText(i18n.t('login.confirm_password'))).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('login.next') }));
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('login.error.username_required'));
    expect(onLogin).not.toHaveBeenCalled();
  });
  it('sets up a missing local account and authenticates only after committed setup', async () => {
    let committed = false;
    const onLogin = vi.fn(async () => { committed = !!await readRecord('new-ui'); });
    render(<Login onLogin={onLogin} />);
    await next('new-ui');
    expect(screen.getByText(i18n.t('login.setup_notice'))).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
    expect(await readRecord('new-ui')).toBeNull();
    fill(synthetic()); submit();
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    await waitFor(() => expect(committed).toBe(true));
    const account = (await readRecord('new-ui'))!;
    expect(await readCredential(account.accountId)).not.toBeNull();
    expect(getSessionUsername()).toBe('new-ui');
    expect(screen.queryByLabelText(i18n.t('login.password'))).toBeNull();
  });
  it('sets up a credentialless predecessor without replacing retained data', async () => {
    const id = (await createAccount('prior-ui')).accountId!;
    await appendHit(id, { id: 'retained-ui', at: 1, schemaVersion: 1, recordVersion: '1' });
    const before = await readFullRecord(id), onLogin = vi.fn();
    render(<Login onLogin={onLogin} />); await next('prior-ui'); fill(synthetic()); submit();
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(await readFullRecord(id)).toEqual(before);
  });
  it('requires the existing credential and keeps a generic visible error on a safe retry', async () => {
    const password = synthetic(); await register('existing-ui', password); logout();
    const onLogin = vi.fn(); render(<Login onLogin={onLogin} />); await next('existing-ui');
    expect(screen.queryByLabelText(i18n.t('login.confirm_password'))).toBeNull();
    fill('SYNTHETIC-WRONG'); fireEvent.click(screen.getByRole('button', { name: i18n.t('login.button') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('login.error.invalid_credentials'));
    expect(onLogin).not.toHaveBeenCalled();
    expect(getSessionUsername()).toBeNull();
    fill(password); fireEvent.click(screen.getByRole('button', { name: i18n.t('login.button') }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
  });
  it.each([
    ['password_too_short', () => 'x'.repeat(5), (p: string) => p],
    ['password_same_as_handle', (): string => ' POLICY-UI ', (p: string): string => p],
    ['password_too_common', (): string => 'PaSsWoRd', (p: string): string => p],
    ['password_too_long', () => String.fromCodePoint(0x754c).repeat(342), (p: string) => p],
    ['password_invalid_unicode', () => 'x'.repeat(12) + '\ud800', (p: string) => p],
    ['confirmation_mismatch', synthetic, synthetic],
  ] as const)('shows localized policy reason %s without creating the account', async (code, make, confirm) => {
    const onLogin = vi.fn(); render(<Login onLogin={onLogin} />); await next('policy-ui');
    const password = make(); fill(password, confirm(password)); submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t(`login.error.${code}`));
    expect(await readRecord('policy-ui')).toBeNull();
    expect(onLogin).not.toHaveBeenCalled();
  });
  it('back and account change discard both password fields while preserving the username', async () => {
    render(<Login onLogin={vi.fn()} />); await next('first-ui'); fill(synthetic());
    fireEvent.click(screen.getByRole('button', { name: i18n.t('login.back') }));
    expect(screen.getByLabelText(i18n.t('login.username'))).toHaveValue('first-ui');
    expect(screen.queryByLabelText(i18n.t('login.password'))).toBeNull();
    await next('second-ui');
    expect((screen.getByLabelText(i18n.t('login.password')) as HTMLInputElement).value === '').toBe(true);
    expect((screen.getByLabelText(i18n.t('login.confirm_password')) as HTMLInputElement).value === '').toBe(true);
  });
  it('unmounting discards sensitive state and suppresses the login callback after a pending submit', async () => {
    const onLogin = vi.fn(), view = render(<Login onLogin={onLogin} />);
    await next('unmount-ui'); fill(synthetic()); submit(); view.unmount();
    await waitFor(async () => expect((await lookupLocalIdentity('unmount-ui')).step).toBe('password'));
    expect(onLogin).not.toHaveBeenCalled();
    render(<Login onLogin={onLogin} />); await next('unmount-ui');
    expect((screen.getByLabelText(i18n.t('login.password')) as HTMLInputElement).value === '').toBe(true);
  });
  it('five failed verifications remain in cooldown after back and another lookup', async () => {
    const password = synthetic(); await register('cool-ui', password); logout();
    const onLogin = vi.fn(); render(<Login onLogin={onLogin} />); await next('cool-ui');
    for (let count = 1; count <= 5; count++) {
      fill('SYNTHETIC-WRONG');
      fireEvent.click(screen.getByRole('button', { name: i18n.t('login.button') }));
      await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('login.button') })).toBeEnabled());
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t(count === 5 ? 'login.error.cooldown' : 'login.error.invalid_credentials'));
    }
    fireEvent.click(screen.getByRole('button', { name: i18n.t('login.back') })); await next('cool-ui');
    fill(password); fireEvent.click(screen.getByRole('button', { name: i18n.t('login.button') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('login.error.cooldown'));
    expect(onLogin).not.toHaveBeenCalled();
  });
  it.each(['en_us', 'zh_cn', 'zh_tw'] as const)('localizes every error, setup rule and irreversible-loss notice in %s', async locale => {
    await i18n.setLanguage(locale);
    const codes = ['username_required', 'password_too_short', 'password_too_long', 'password_invalid_unicode', 'password_same_as_handle', 'password_too_common', 'confirmation_mismatch', 'invalid_credentials', 'cooldown', 'credential_invalid', 'identity_changed', 'setup_required', 'storage_failed'];
    const marker = synthetic();
    for (const code of codes) {
      const view = render(<LoginError reason={{ code, message: marker }} />);
      expect(screen.getByRole('alert')).toHaveTextContent(i18n.t(`login.error.${code}`));
      expect(screen.getByRole('alert').textContent?.includes(marker)).toBe(false);
      expect(screen.getByRole('alert').textContent?.includes('login.error.')).toBe(false);
      view.unmount();
    }
    render(<Login onLogin={vi.fn()} />); await next('locale-ui');
    for (const key of ['login.password_rules', 'login.setup_notice', 'login.device_notice']) expect(screen.getByText(i18n.t(key))).toBeInTheDocument();
  });
  it('renders a generic localized fallback instead of unknown exception messages', () => {
    const marker = synthetic(); render(<LoginError reason={new Error(marker)} />);
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('login.error.login_failed'));
    expect(screen.getByRole('alert').textContent?.includes(marker)).toBe(false);
  });
  it('does not normalize whitespace or decomposed Unicode before actual password authentication', async () => {
    const password = '  ' + 'é'.repeat(12) + '  ';
    const onLogin = vi.fn(); render(<Login onLogin={onLogin} />); await next('unicode-ui'); fill(password); submit();
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    logout();
    await expect(login('unicode-ui', password.normalize('NFC'))).rejects.toMatchObject({ code: 'invalid_credentials' });
    await act(async () => { expect((await login('unicode-ui', password)).username).toBe('unicode-ui'); });
  });
});
