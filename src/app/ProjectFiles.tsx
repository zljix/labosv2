import {useEffect, useRef, useState} from 'react';
import {tabKeys} from '../platform/tabs';
import './project-files.css';

const sourcePath = (path: string) => /\.(py|ino|cpp|c|h|hpp|md|txt)$/i.test(path);
const fileType = (path: string) => path.split('.').at(-1)?.toLowerCase() || 'dat';
export const fileTabId = (path: string) => `file-tab-${encodeURIComponent(path)}`;

interface FileProps {
  files: Record<string, string>;
  active: string;
  onSelect: (path: string) => void;
}

/** Filtering and disclosure are view state; every file remains in the project. */
export function ProjectFiles({files, active, entryFile, onSelect}: FileProps & {entryFile: string}) {
  const [query, setQuery] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(!sourcePath(active));
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {if (!sourcePath(active)) setAdvancedOpen(true);}, [active]);
  const term = query.trim().toLocaleLowerCase('hr');
  const paths = Object.keys(files).filter(path => path.toLocaleLowerCase('hr').includes(term))
    .sort((a, b) => a === entryFile ? -1 : b === entryFile ? 1 : a.localeCompare(b, 'hr'));
  const rows = (advanced: boolean) => paths.filter(path => sourcePath(path) !== advanced).map(path => (
    <button key={path} className={`file-row ${path === active ? 'selected' : ''}`}
      aria-current={path === active ? 'true' : undefined} onClick={() => onSelect(path)} title={path}>
      <span className={`file-type ${path.toLowerCase().endsWith('.py') ? 'python' : ''}`}>{fileType(path)}</span>
      <span>{path}</span>
      {path === entryFile && <small title="Datoteka koju pokreće simulator">Glavna</small>}
    </button>
  ));
  const program = rows(false), advanced = rows(true);
  return <div className="project-file-browser">
    <label className="file-search">Pronađi datoteku
      <input ref={search} type="search" value={query} placeholder="Naziv ili dio putanje"
        onInput={e => setQuery(e.currentTarget.value)} onKeyDown={e => {
          if (e.key === 'Escape') {e.preventDefault();setQuery('');}
          if (e.key === 'Enter' && paths.length === 1) {e.preventDefault();onSelect(paths[0]);}
        }}/>
    </label>
    {term && <p className="file-search-count" role="status">Pronađeno: {paths.length} / {Object.keys(files).length}</p>}
    <div className="file-list">
      {program.length > 0 && <section className="file-group" aria-label="Program i upute"><h3>Program i upute</h3>{program}</section>}
      {advanced.length > 0 && <details className="file-group" open={Boolean(term) || advancedOpen}
        onToggle={e => {if (!term) setAdvancedOpen(e.currentTarget.open);}}>
        <summary>Pomoćne datoteke · {advanced.length}</summary>
        <p className="file-group-help">Zapisi vježbe, rezultati i podaci projekta. Odgovore unosi u Uputama, a predaju prati u Mojem radu.</p>
        {advanced}
      </details>}
      {paths.length === 0 && <div className="file-search-empty"><p>Nema datoteke s tim nazivom.</p><button onClick={() => {setQuery('');search.current?.focus();}}>Prikaži sve datoteke</button></div>}
    </div>
  </div>;
}

/** Closing a tab never deletes a file or changes its contents. */
export function FileTabs({files, active, onSelect, onCreate}: FileProps & {onCreate: () => void}) {
  const [opened, setOpened] = useState([active]);
  const focusAfterClose = useRef<string | null>(null);
  const paths = [...new Set([...opened, active])].filter(path => Object.hasOwn(files, path));
  const fileNames = Object.keys(files).join('\n');
  useEffect(() => {
    setOpened(previous => [...new Set([...previous.filter(path => Object.hasOwn(files, path)), active])]);
  }, [active, fileNames]);
  useEffect(() => {
    const selected = document.getElementById(fileTabId(active));
    selected?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
    if (focusAfterClose.current) {
      document.getElementById(fileTabId(focusAfterClose.current))?.focus();
      focusAfterClose.current = null;
    }
  }, [active, paths.join('\n')]);
  function close(path: string) {
    if (paths.length < 2) return;
    const remaining = paths.filter(item => item !== path);
    const next = path === active ? remaining[Math.min(paths.indexOf(path), remaining.length - 1)] : active;
    focusAfterClose.current = next;
    setOpened(remaining);
    if (next !== active) onSelect(next);
  }
  return <div className="file-tabs-bar">
    <div className="file-tabs" role="tablist" aria-label="Otvorene datoteke" onKeyDown={e => {
      if (e.key === 'Delete' && (e.target as HTMLElement).getAttribute('role') === 'tab') {
        e.preventDefault();close(active);
      } else tabKeys(e);
    }}>
      {paths.map(path => <div className={`file-tab ${path === active ? 'active' : ''}`} key={path} role="presentation">
        <button role="tab" id={fileTabId(path)} aria-controls="file-content" aria-selected={path === active}
          tabIndex={path === active ? 0 : -1} onClick={() => onSelect(path)} title={path}>
          <span className={`file-type ${path.toLowerCase().endsWith('.py') ? 'python' : ''}`}>{fileType(path)}</span>
          <span>{path}</span>
        </button>
        {paths.length > 1 && <button className="close-file-tab" tabIndex={path === active ? 0 : -1}
          aria-label={`Zatvori karticu ${path}`} title="Zatvori karticu; datoteka ostaje u projektu" onClick={() => close(path)}>×</button>}
      </div>)}
    </div>
    <button className="new-tab" onClick={onCreate} aria-label="Dodaj datoteku" title="Nova datoteka">+</button>
  </div>;
}
