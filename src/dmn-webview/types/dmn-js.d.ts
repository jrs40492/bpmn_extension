declare module 'dmn-js/lib/Modeler' {
  interface DmnJSOptions {
    container?: HTMLElement | string;
    drd?: {
      propertiesPanel?: {
        parent: HTMLElement | string | null;
      };
      additionalModules?: unknown[];
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

declare module 'dmn-js-properties-panel' {
  export const DmnPropertiesPanelModule: unknown;
  export const DmnPropertiesProviderModule: unknown;
  export const CamundaPropertiesProviderModule: unknown;
  export const ZeebePropertiesProviderModule: unknown;
  export function useService(name: string): any;
}

declare module '@bpmn-io/properties-panel' {
  export function SelectEntry(props: {
    id: string;
    element: any;
    label: string;
    getValue: () => string;
    setValue: (value: string) => void;
    getOptions: () => Array<{ value: string; label: string }>;
  }): any;

  export function TextFieldEntry(props: {
    id: string;
    element: any;
    label: string;
    getValue: () => string;
    setValue: (value: string) => void;
    debounce?: any;
  }): any;

  export function Group(props: any): any;
}
