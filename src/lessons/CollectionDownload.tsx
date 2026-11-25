import {useState, type ReactNode} from 'react';
import {download} from '../project/archive';

export function CollectionDownload({href, children}: {href: string; children: ReactNode}) {
  const [error, setError] = useState(false);
  return <><a href={href} download onClick={async event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setError(false);
    try {
      // A normal fetch can use the offline service worker even when a native download bypasses it.
      const response = await fetch(href);
      if (!response.ok) throw new Error(String(response.status));
      const filename = href.slice(href.lastIndexOf('/') + 1);
      const data = new Uint8Array(await response.arrayBuffer());
      download(filename, data, response.headers.get('Content-Type') || 'application/octet-stream');
    } catch {
      setError(true);
    }
  }}>{children}</a>{error && <span role="alert">Preuzimanje nije uspjelo. Ponovno pokreni lokalni poslužitelj i odaberi datoteku.</span>}</>;
}
