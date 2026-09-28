declare module "react" {
  const React: any;
  export default React;
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
}
declare module "react-dom/client" {
  const ReactDOM: { createRoot(node: Element | DocumentFragment): { render(value: unknown): void } };
  export default ReactDOM;
}
declare namespace JSX {
  interface IntrinsicElements { [elementName: string]: any; }
  interface Element {}
}
