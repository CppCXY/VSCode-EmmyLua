
import * as vscode from 'vscode';
import { AnnotatorType } from './notifications';
import { LanguageClient } from 'vscode-languageclient';
import * as notifications from "./notifications";
import { create } from 'domain';

let D_PARAM: vscode.TextEditorDecorationType;
let D_GLOBAL: vscode.TextEditorDecorationType;
let D_DOC_TYPE: vscode.TextEditorDecorationType;
let D_UPVALUE: vscode.TextEditorDecorationType;
let D_PARAMHINT: vscode.TextEditorDecorationType;

function createDecoration(key: string, config: vscode.DecorationRenderOptions | undefined = undefined): vscode.TextEditorDecorationType {
    let color = vscode.workspace.getConfiguration("emmylua").get(key);
    config = config || {};
    if (typeof (color) === 'string') {
        config.light = { color: color };
        config.dark = { color: color };
    }
    return vscode.window.createTextEditorDecorationType(config);
}

function updateDecorations() {
    D_PARAM = createDecoration("colors.parameter");
    D_GLOBAL = createDecoration("colors.global");
    D_DOC_TYPE = createDecoration("colors.doc_type");
    D_UPVALUE = createDecoration("", { textDecoration: "underline" });
    D_PARAMHINT = vscode.window.createTextEditorDecorationType({});
}

export function onDidChangeConfiguration(client: LanguageClient) {
    updateDecorations();
}

let timeoutToReqAnn: NodeJS.Timer;

export function requestAnnotators(editor: vscode.TextEditor, client: LanguageClient) {
    clearTimeout(timeoutToReqAnn);
    timeoutToReqAnn = setTimeout(() => {
        requestAnnotatorsImpl(editor, client);
    }, 150);
}

function requestAnnotatorsImpl(editor: vscode.TextEditor, client: LanguageClient) {
    if (!D_PARAM) {
        updateDecorations();
    }

    let params: notifications.AnnotatorParams = { uri: editor.document.uri.toString() };
    client.sendRequest<notifications.IAnnotator[]>("emmy/annotator", params).then(list => {
        let map: Map<AnnotatorType, notifications.RenderRange[]> = new Map();
        map.set(AnnotatorType.DocType, []);
        map.set(AnnotatorType.Param, []);
        map.set(AnnotatorType.Global, []);
        map.set(AnnotatorType.Upvalue, []);
        map.set(AnnotatorType.Hint, []);

        list.forEach(data => {
            let uri = vscode.Uri.parse(data.uri);
            vscode.window.visibleTextEditors.forEach((editor) => {
                let docUri = editor.document.uri;
                if (uri.path.toLowerCase() === docUri.path.toLowerCase()) {
                    let list = map.get(data.type);
                    if (list === undefined) {
                        list = data.ranges;
                    } else {
                        list = list.concat(data.ranges);
                    }
                    map.set(data.type, list);
                }
            });
        });
        map.forEach((v, k) => {
            updateAnnotators(editor, k, v);
        });
    });
}

function updateAnnotators(editor: vscode.TextEditor, type: AnnotatorType, renderRanges: notifications.RenderRange[]) {
    switch (type) {
        case AnnotatorType.Param:
            editor.setDecorations(D_PARAM, renderRanges.map(e => e.range));
            break;
        case AnnotatorType.Global:
            editor.setDecorations(D_GLOBAL, renderRanges.map(e => e.range));
            break;
        case AnnotatorType.DocType:
            editor.setDecorations(D_DOC_TYPE, renderRanges.map(e => e.range));
            break;
        case AnnotatorType.Upvalue:
            editor.setDecorations(D_UPVALUE, renderRanges.map(e => e.range));
        case AnnotatorType.Hint: {
            
            let vscodeRenderRanges: vscode.DecorationOptions[] = []
            renderRanges.forEach(renderRange => {
                if (renderRange.hint && renderRange.hint !== "") {
                    let render = {
                        range: renderRange.range,
                        renderOptions: {
                            before: {
                                contentText: `${renderRange.hint}: `,
                                color: "gray",
                                opacity: 0.2,
                                backgroundColor: 'black',
                                borderRadius: '5px',
                                fontStyle: 'italic',
                                fontWeight: '400; font-size: 12px; line-height: 1;'
                            }
                        }
                    };
                    vscodeRenderRanges.push(render);
                }
            });

            editor.setDecorations(D_PARAMHINT, vscodeRenderRanges);
            break;
        }
    }
}