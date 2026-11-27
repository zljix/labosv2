import type { Project } from '../src/project/model';
import type { LiveInput } from '../src/circuit/model';
import type { ExerciseId } from '../src/lessons/collectionPlans';

// Independent reference changes a pupil can make using the worksheet, including
// experiments that change a wire or a sensor while the source stays the same.
export function modifiedPractice(id: ExerciseId, p: Project) {
  const py = p.language === 'micropython',
    file = p.entryFile,
    lib = py ? 'ventil.py' : 'ventil.h';
  const inputs: Record<string, LiveInput> = {};
  function temperature(kind: string, t: number) {
    inputs[p.circuit.components.find((c) => c.kind === kind)!.id] = { temperature: t };
  }
  function disconnect(component: string, pin: string) {
    p.circuit.wires = p.circuit.wires.filter(
      (w) => ![w.from, w.to].some((end) => end.component === component && end.pin === pin)
    );
  }
  const edit = (a: string | RegExp, b: string) => {
    p.files[file] = p.files[file].replace(a, b);
  };
  switch (id) {
    case 'P0':
      edit('Pozdrav iz Labosa', 'Moje mjerenje');
      edit('1000', '2000');
      break;
    case 'V1.1':
    case 'V3.7':
      temperature('ds18b20', 26.5);
      break;
    case 'V1.2':
      disconnect('led1', 'K');
      break;
    case 'V1.3':
      edit(/= 500/g, '= 1000');
      break;
    case 'V1.4':
    case 'V2.2':
    case 'V3.6':
      edit('INTERVAL_MS = 2000', 'INTERVAL_MS = 3000');
      if (id === 'V3.6') p.circuit.components[1].x += 20;
      break;
    case 'V1.5':
      edit(py ? '24000' : '1500', py ? '4000' : '250');
      break;
    case 'V1.6':
      edit('DRUGA_SVJETLINA = 75', 'DRUGA_SVJETLINA = 50');
      edit('DRUGI_KUT = 90', 'DRUGI_KUT = 120');
      break;
    case 'V1.7':
      edit('KOREKCIJA_C = 0.0', 'KOREKCIJA_C = 1.0');
      break;
    case 'V1.8':
    case 'V3.2':
      edit('DRUGI_KUT = 90', 'DRUGI_KUT = 150');
      break;
    case 'V1.9':
    case 'V3.3':
      inputs.ds1 = { oneWireFault: 'disconnected' };
      break;
    case 'V1.10':
      temperature('ds18b20', 24);
      temperature('dht22', 25);
      break;
    case 'V2.1':
      edit('"OPEN"', '"CLOSE"');
      break;
    case 'V2.3':
      edit('"HTTP"', '"MQTT"');
      break;
    case 'V2.S':
      edit(
        py ? '(1, "OPEN", 0), (1, "OPEN", 0)' : '{1,"OPEN",0},{1,"OPEN",0}',
        py ? '(1, "OPEN", 0), (2, "CLOSE", 0)' : '{1,"OPEN",0},{2,"CLOSE",0}'
      );
      break;
    case 'V2.4':
    case 'V4.4': {
      const state = id === 'V2.4' ? 'OFFLINE' : 'WAIT',
        msg = py ? '(0, "' + state + '", 0)' : '{0,"' + state + '",0}';
      edit(msg, msg + ', ' + msg);
      break;
    }
    case 'V2.5':
      temperature('ds18b20', 29);
      break;
    case 'V2.6':
      temperature('ds18b20', 32);
      break;
    case 'V3.1':
    case 'V4.5':
      temperature('ds18b20', 28);
      break;
    case 'V3.4':
      disconnect('servo', 'SIG');
      break;
    case 'V3.5':
      temperature('ds18b20', 25);
      break;
    case 'V4.1':
    case 'V4.2':
    case 'V4.3':
      p.files[lib] = p.files[lib].replace('PRAG_OTVARANJA = 27.0', 'PRAG_OTVARANJA = 28.0');
      if (id !== 'V4.1') edit(py ? 'PROGRAM = "A"' : "PROGRAM = 'A'", py ? 'PROGRAM = "B"' : "PROGRAM = 'B'");
      break;
    case 'V4.6':
      edit('ALARM_ON = 30.0', 'ALARM_ON = 32.0');
      break;
  }
  return inputs;
}
