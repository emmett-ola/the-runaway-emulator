import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { About, Releases } from './index';
import { i18n } from '../../lib/i18n';
afterEach(cleanup);
it.each(['en_us', 'zh_cn', 'zh_tw'] as const)('links About to localized dated release history without a false latest badge in %s', locale => {
  i18n.setLanguage(locale);
  const about = render(<MemoryRouter><About /></MemoryRouter>);
  expect(screen.getByRole('link', { name: i18n.t('releases.title') })).toHaveAttribute('href', '/releases');
  about.unmount();
  const { container } = render(<MemoryRouter initialEntries={['/releases']}><Releases /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: i18n.t('releases.title') })).toBeInTheDocument();
  expect(container.querySelectorAll('time')).toHaveLength(2);
  expect(container).toHaveTextContent('v1.1.0');
  expect(container).toHaveTextContent('v1.0.0');
  expect(container).not.toHaveTextContent(/Latest|最新/);
  if (locale !== 'en_us') expect(container).not.toHaveTextContent('Pro Mode & Major Updates');
});
