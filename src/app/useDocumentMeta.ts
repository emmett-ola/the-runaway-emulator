import { useEffect } from 'react';
import { i18n } from '../lib/i18n';

export function useDocumentMeta() {
  // Update document title and meta description when language changes
  useEffect(() => {
    const updateMetaInfo = () => {
      document.title = i18n.t('meta.title');

      const descriptionMeta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (descriptionMeta) {
        descriptionMeta.content = i18n.t('meta.description');
      }

      // Also update apple-mobile-web-app-title for iOS home screen
      const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
      if (appleTitleMeta) {
        appleTitleMeta.content = i18n.t('dashboard.brand_title');
      }
    };

    // Initial update
    updateMetaInfo();

    // Subscribe to language changes
    const unsubscribe = i18n.onLanguageChange(updateMetaInfo);

    return () => unsubscribe();
  }, []);
}
