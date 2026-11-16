import { useEffect, useRef, useState } from 'react';
import { i18n } from '../lib/i18n';
import { readRecoveryRecord, readRecoverySnapshot, restoreRecoveryGeneration, type RecoverySnapshot } from '../lib/storage';
import { exportRecoveryData } from '../lib/data/transfer';

interface RecoveryPanelProps { onRestored?: () => void }

/** Recovery observations never enter writable account/session snapshots. */
export const RecoveryPanel = ({ onRestored }: RecoveryPanelProps) => {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot | null>(null);
  const [checked, setChecked] = useState(false);
  const [inaccessible, setInaccessible] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [, setLanguage] = useState(0);
  useEffect(() => i18n.onLanguageChange(() => setLanguage(value => value + 1)), []);
  useEffect(() => {
    let active = true;
    void readRecoverySnapshot().then(value => { if (active) setSnapshot(value); })
      .catch(() => { if (active) setInaccessible(true); });
    return () => { active = false; };
  }, []);
  const rescue = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true); setError('');
    try { await exportRecoveryData(); }
    catch { setError(i18n.t('recovery.rescue_failed')); }
    finally { working.current = false; setBusy(false); }
  };
  const restore = async () => {
    if (!snapshot?.readableTree || !checked || working.current) return;
    working.current = true;
    setBusy(true); setError('');
    try {
      await restoreRecoveryGeneration(snapshot.readableTree.generation, true, snapshot.current);
      onRestored?.();
    } catch { setError(i18n.t('recovery.failed')); }
    finally { working.current = false; setBusy(false); }
  };
  const view = async (accountId: string) => {
    if (!snapshot?.readableTree || working.current) return;
    working.current = true; setBusy(true); setError('');
    try { setDetails(JSON.stringify(await readRecoveryRecord(snapshot.readableTree.generation, accountId), null, 2)); }
    catch { setError(i18n.t('recovery.failed')); }
    finally { working.current = false; setBusy(false); }
  };
  const tree = snapshot?.readableTree;
  return <section className="login-card" aria-labelledby="recovery-title">
    <h1 id="recovery-title">{i18n.t('recovery.title')}</h1>
    <p role="alert">{i18n.t('recovery.blocked')}</p>
    {!snapshot && !inaccessible && <p role="status">{i18n.t('recovery.loading')}</p>}
    {inaccessible && <p>{i18n.t('recovery.inaccessible')}</p>}
    {snapshot && <>
      {tree ? <div aria-readonly="true">
        <h2>{tree.current ? i18n.t('recovery.current') : i18n.t('recovery.previous', { generation: tree.generation, revision: tree.revision })}</h2>
        <ul>{tree.accounts.map(account => <li key={account.accountId}>
          {i18n.t('recovery.account', { handle: account.handle, count: account.total })}
          <button type="button" disabled={busy} onClick={() => view(account.accountId)}>{i18n.t('recovery.view')}</button>
        </li>)}</ul>
        {details && <pre aria-label={i18n.t('recovery.details')} tabIndex={0} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '20rem', overflow: 'auto' }}>{details}</pre>}
      </div> : <p>{i18n.t('recovery.none')}</p>}
      <p>{i18n.t('recovery.rescue_warning')}</p>
      <button type="button" disabled={busy || !snapshot.files.length} onClick={rescue}>{i18n.t('recovery.rescue')}</button>
      {tree && !tree.current && <div>
        <label><input type="checkbox" checked={checked} disabled={busy} onChange={event => setChecked(event.target.checked)} />{i18n.t('recovery.confirm')}</label>
        <button type="button" disabled={!checked || busy} onClick={restore}>{i18n.t(busy ? 'recovery.restoring' : 'recovery.restore')}</button>
      </div>}
    </>}
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={() => window.location.reload()}>{i18n.t('recovery.retry')}</button>
  </section>;
};
