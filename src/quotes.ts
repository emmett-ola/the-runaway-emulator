import { i18n } from './lib/i18n';

export const getRandomQuote = (): string => {
  const quotes = i18n.getQuotes();
  return quotes[Math.floor(Math.random() * quotes.length)];
};
