import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import css from 'rollup-plugin-css-only';

const production = !process.env.ROLLUP_WATCH;

// Extension bundle (Node.js)
const extensionConfig = {
  input: 'src/extension/extension.ts',
  output: {
    file: 'dist/extension/extension.js',
    format: 'cjs',
    sourcemap: true,
    exports: 'named'
  },
  external: ['vscode'],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'bundler',
        noEmit: false,
        declaration: false
      },
      sourceMap: true,
      inlineSources: !production
    }),
    resolve({
      preferBuiltins: true
    }),
    commonjs(),
    json(),
    production && terser()
  ]
};

// BPMN Webview bundle (Browser)
const bpmnWebviewConfig = {
  input: 'src/webview/index.ts',
  output: {
    file: 'dist/webview/webview.js',
    format: 'iife',
    name: 'webview',
    sourcemap: true
  },
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development')
    }),
    typescript({
      tsconfig: './tsconfig.webview.json',
      sourceMap: true,
      inlineSources: !production
    }),
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    json(),
    css({ output: 'webview.css' }),
    production && terser()
  ]
};

// DMN Webview bundle (Browser)
const dmnWebviewConfig = {
  input: 'src/dmn-webview/index.ts',
  output: {
    file: 'dist/webview/dmn-webview.js',
    format: 'iife',
    name: 'dmnWebview',
    sourcemap: true,
    banner: 'var process = { env: {} };' // Define process for browser compatibility
  },
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development')
    }),
    typescript({
      tsconfig: './tsconfig.webview.json',
      sourceMap: true,
      inlineSources: !production
    }),
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    json(),
    css({ output: 'dmn-webview.css' }),
    production && terser()
  ]
};

export default [extensionConfig, bpmnWebviewConfig, dmnWebviewConfig];
