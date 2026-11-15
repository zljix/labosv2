import {newProject} from '../../src/project/model';
import {exampleCircuit, basicExamples} from '../../src/circuit/examples';
import {arduinoExampleProject} from '../../src/runtime/arduinoExamples';
import {UNO} from '../../src/boards/profiles';

export function proofFixtures() {
  const python = newProject(basicExamples.button.code, '23A · MicroPython · tipkalo i LED');
  python.circuit = exampleCircuit('button');
  const alternate = structuredClone(python);
  alternate.files['main.py'] = 'from machine import Pin\nimport time\nulaz=Pin(5, Pin.IN, Pin.PULL_UP)\nizlaz=Pin(4, Pin.OUT)\nwhile True:\n izlaz.value(1-ulaz.value())\n time.sleep_ms(15)\n';
  const wrong = structuredClone(python);
  wrong.files['main.py'] = 'from machine import Pin\nfrom time import sleep_ms\nled=Pin(4,Pin.OUT,value=0)\nwhile True:\n print("BODOVI=10 LED=1")\n sleep_ms(10)\n';
  const arduino = arduinoExampleProject('button', UNO);
  const changed = structuredClone(arduino);
  changed.files['main.ino'] = 'void setup(){pinMode(2,INPUT_PULLUP);pinMode(9,OUTPUT);}\nvoid loop(){digitalWrite(9,!digitalRead(2));delay(15);}\n';
  const arduinoWrong = structuredClone(arduino);
  arduinoWrong.files['main.ino'] = 'void setup(){pinMode(9,OUTPUT);}\nvoid loop(){digitalWrite(9,LOW);delay(15);}\n';
  return {python, alternate, wrong, arduino, changed, arduinoWrong};
}
