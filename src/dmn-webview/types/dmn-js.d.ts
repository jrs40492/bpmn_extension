declare module 'dmn-js/lib/Modeler' {
  interface DmnJSOptions {
    container?: HTMLElement | string;
    drd?: {
      propertiesPanel?: {
        parent: HTMLElement | string | null;
      };
    };
    common?: {
      keyboard?: {
        bindTo?: HTMLElement | Document;
      };
    };
  }

  interface DmnView {
    id: string;
    name: string;
    type: 'drd' | 'decisionTable' | 'literalExpression' | string;
    element?: unknown;
  }

  interface Canvas {
    zoom(level?: number | 'fit-viewport'): number;
  }

  interface Viewer {
    get(service: 'canvas'): Canvas;
    get(service: string): unknown;
  }

  interface SaveXMLResult {
    xml: string;
  }

  class DmnJS {
    constructor(options?: DmnJSOptions);
    importXML(xml: string): Promise<void>;
    saveXML(options?: { format?: boolean }): Promise<SaveXMLResult>;
    getViews(): DmnView[];
    getActiveViewer(): Viewer | null;
    open(view: DmnView): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback?: (...args: unknown[]) => void): void;
  }

  export default DmnJS;
}
