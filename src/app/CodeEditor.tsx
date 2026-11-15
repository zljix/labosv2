import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import {cpp} from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
interface Props {
  path: string;
  value: string;
  theme: "light" | "dark";
  fontSize: number;
  onChange: (v: string) => void;
  onRun: () => void;
  onSave: () => void;
  onCursor: (row: number, column: number) => void;
  reveal?: {line:number;column:number;token:number};
}
export default function CodeEditor(props: Props) {
  const el = useRef<HTMLDivElement>(null),
    view = useRef<EditorView>(undefined),
    latest = useRef(props),
    theme = useRef(new Compartment()),
    font = useRef(new Compartment()),
    states = useRef(new Map<string, EditorState>()),
    replacing = useRef(false);
  latest.current = props;
  useEffect(() => {
    const cached = states.current.get(props.path);
    const state =
      cached && cached.doc.toString() === props.value
        ? cached
        : EditorState.create({
            doc: props.value,
            extensions: [
              basicSetup,
              ...(props.path.endsWith(".py") ? [python()] : /\.(ino|cpp|c|h|hpp)$/.test(props.path) ? [cpp()] : []),
              EditorState.tabSize.of(4),
              keymap.of([
                indentWithTab,
                {
                  key: "Mod-Enter",
                  run: () => {
                    latest.current.onRun();
                    return true;
                  },
                },
                {
                  key: "Mod-s",
                  run: () => {
                    latest.current.onSave();
                    return true;
                  },
                },
              ]),
              EditorView.contentAttributes.of({
                "aria-label": `Kôd datoteke ${props.path}`,
                spellcheck: "false",
                autocapitalize: "off",
              }),
              theme.current.of(props.theme === "dark" ? oneDark : []),
              font.current.of(
                EditorView.theme({ "&": { fontSize: `${props.fontSize}px` } }),
              ),
              EditorView.updateListener.of((update) => {
                if (update.docChanged && !replacing.current)
                  latest.current.onChange(update.state.doc.toString());
                if (update.selectionSet || update.docChanged) {
                  const head = update.state.selection.main.head,
                    line = update.state.doc.lineAt(head);
                  latest.current.onCursor(line.number, head - line.from + 1);
                }
              }),
            ],
          });
    const editor = new EditorView({ state, parent: el.current! });
    view.current = editor;
    const head = state.selection.main.head,
      line = state.doc.lineAt(head);
    latest.current.onCursor(line.number, head - line.from + 1);
    return () => {
      states.current.set(props.path, editor.state);
      editor.destroy();
    };
  }, [props.path]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== props.value) {
      replacing.current = true;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: props.value },
      });
      replacing.current = false;
    }
  });
  useEffect(() => {
    view.current?.dispatch({
      effects: [
        theme.current.reconfigure(props.theme === "dark" ? oneDark : []),
        font.current.reconfigure(
          EditorView.theme({ "&": { fontSize: `${props.fontSize}px` } }),
        ),
      ],
    });
  }, [props.theme, props.fontSize, props.path]);
  useEffect(()=>{
    const editor=view.current,at=props.reveal;if(!editor||!at)return;
    const line=editor.state.doc.line(Math.min(Math.max(1,at.line),editor.state.doc.lines)),pos=Math.min(line.to,line.from+Math.max(0,at.column-1));
    editor.dispatch({selection:{anchor:pos},effects:EditorView.scrollIntoView(pos,{y:'center'})});editor.focus();
  },[props.path,props.reveal?.token]);
  return <div className="editor-mount" ref={el} />;
}
