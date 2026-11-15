import {useEffect, useState} from 'react';
import {appAsset} from './assets';

export default function SchoolAccountLink() {
  const [label, setLabel] = useState('Školski račun');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(appAsset('api/index.php?action=session'), {credentials: 'same-origin', cache: 'no-store', signal: controller.signal})
      .then(async response => response.ok ? response.json() : null)
      .then(state => {if (state?.application === 'labosv2' && state.user) setLabel(state.user.displayName);})
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <a className="system-trigger school-account-link" href={appAsset('school.html#account')} aria-label="Školski račun i prijava">{label}</a>;
}
