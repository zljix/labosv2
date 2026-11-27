import { useEffect, useRef, useState } from 'react';
import type { Project } from '../project/model';
import { localAssessment } from './local';
import { proposedGrade, defaultScale } from './marks';

export function CollectionCheck({
  taskKey,
  project,
  thresholds
}: {
  taskKey: string;
  project: Project;
  thresholds?: number[];
}) {
  const [report, setReport] = useState<Awaited<ReturnType<typeof localAssessment>>>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    setReport(undefined);
    setError('');
    setBusy(false);
    return () => {
      controller.current?.abort();
      controller.current = undefined;
    };
  }, [taskKey, project.id, project.revision]);
  async function check() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError('');
    setReport(undefined);
    try {
      const r = await localAssessment(taskKey, project, c.signal);
      if (!c.signal.aborted) setReport(r);
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="lesson-check">
      <h3>Automatska provjera vježbe</h3>
      <button className="primary" disabled={busy} onClick={() => void check()}>
        {busy ? 'Provjeravam pokuse…' : 'Provjeri spremljene pokuse'}
      </button>
      {busy && (
        <button
          onClick={() => {
            controller.current?.abort();
            setBusy(false);
          }}
        >
          Prekini provjeru
        </button>
      )}
      <div role="status">
        {report && (
          <>
            <h4>
              {report.points} / {report.maxPoints} bodova · probna ocjena{' '}
              {proposedGrade(
                report.points,
                report.maxPoints,
                Array.isArray(thresholds) && thresholds.length === 4 ? thresholds : defaultScale
              )}
            </h4>
            <ul>
              {report.criteria.map((c) => (
                <li key={c.id}>
                  <b>
                    {c.points}/{c.maxPoints}
                  </b>{' '}
                  · {c.description}
                  <br />
                  {c.explanation}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="lesson-small">
        U pregledniku dobivaš probni rezultat. U školskoj dodjeli poslužitelj sam provjerava spremljenu
        reviziju i prikazuje rezultat u odjeljku Moji bodovi.
      </p>
    </section>
  );
}
