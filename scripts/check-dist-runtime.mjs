import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Window } from 'happy-dom';

function captureOutcome(action) {
  try {
    return { kind: 'value', value: action() };
  } catch (error) {
    return { kind: 'error', name: error?.name };
  }
}

function descriptorMetadata(descriptor) {
  return {
    configurable: descriptor?.configurable,
    enumerable: descriptor?.enumerable,
    writable: descriptor?.writable,
  };
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const coreManifest = JSON.parse(
  await readFile(resolve(workspaceRoot, 'packages/core/package.json'), 'utf8'),
);
const reactManifest = JSON.parse(
  await readFile(resolve(workspaceRoot, 'packages/react/package.json'), 'utf8'),
);
const productionDependencies = new Set([
  ...Object.keys(coreManifest.dependencies ?? {}),
  ...Object.keys(reactManifest.dependencies ?? {}),
]);
const runtimeScenarios = [
  {
    label: 'React 18',
    peerRoot: resolve(workspaceRoot, 'fixtures/consumer-react18/node_modules'),
  },
  {
    label: 'React 19',
    peerRoot: resolve(workspaceRoot, 'fixtures/consumer/node_modules'),
  },
];

async function runRuntimeScenario({ label, peerRoot }) {
  const isolatedRoot = await mkdtemp(join(tmpdir(), `simple-html-editor-${label}-runtime-`));
  const cleanupIsolatedRoot = () => rmSync(isolatedRoot, { recursive: true, force: true });
  process.once('exit', cleanupIsolatedRoot);
  const isolatedPackage = join(isolatedRoot, 'simple-html-editor-react');
  const isolatedNodeModules = join(isolatedRoot, 'node_modules');

  await cp(join(workspaceRoot, 'packages/react/dist'), isolatedPackage, { recursive: true });
  await mkdir(isolatedNodeModules);
  const isolatedCore = join(isolatedNodeModules, '@cp949/simple-html-editor-core');
  await mkdir(dirname(isolatedCore), { recursive: true });
  await cp(join(workspaceRoot, 'packages/core/dist'), isolatedCore, { recursive: true });

  const installedDependencies = new Set();

  async function installDependency(dependency, dependencyTarget) {
    if (installedDependencies.has(dependency)) return;
    installedDependencies.add(dependency);

    const dependencyLink = join(isolatedNodeModules, dependency);
    await mkdir(dirname(dependencyLink), { recursive: true });
    // pnpm store symlink를 그대로 사용하면 React 18 scenario도 React 19 peer snapshot을 따라간다.
    // package 내용을 복사해 각 격리 node_modules의 React peer를 해석하게 한다.
    await cp(dependencyTarget, dependencyLink, { recursive: true });

    const dependencyManifest = JSON.parse(
      await readFile(join(dependencyTarget, 'package.json'), 'utf8'),
    );
    const sourceNodeModules = resolve(
      dependencyTarget,
      dependency.startsWith('@') ? '../..' : '..',
    );
    const requiredDependencies = Object.keys(dependencyManifest.dependencies ?? {});
    const optionalDependencies = Object.keys(dependencyManifest.optionalDependencies ?? {});

    for (const childDependency of [...requiredDependencies, ...optionalDependencies]) {
      if (childDependency === 'react' || childDependency === 'react-dom') continue;
      let childTarget;
      try {
        childTarget = await realpath(join(sourceNodeModules, childDependency));
      } catch (error) {
        if (optionalDependencies.includes(childDependency)) continue;
        throw new Error(
          `${dependency}의 runtime dependency를 해석할 수 없습니다: ${childDependency}`,
          { cause: error },
        );
      }
      await installDependency(childDependency, childTarget);
    }
  }

  for (const dependency of productionDependencies) {
    if (dependency === '@cp949/simple-html-editor-core') continue;
    let dependencyTarget;
    for (const packageDirectory of ['packages/react', 'packages/core']) {
      try {
        dependencyTarget = await realpath(
          join(workspaceRoot, packageDirectory, 'node_modules', dependency),
        );
        break;
      } catch {
        // 실제 dependency를 선언한 workspace package를 계속 찾는다.
      }
    }
    if (!dependencyTarget) throw new Error(`설치된 runtime dependency가 없습니다: ${dependency}`);
    await installDependency(dependency, dependencyTarget);
  }

  for (const peer of ['react', 'react-dom']) {
    const peerTarget = await realpath(join(peerRoot, peer));
    await symlink(peerTarget, join(isolatedNodeModules, peer), 'dir');
  }

  const browser = new Window({ url: 'http://localhost/' });
  const exposedGlobals = [
    'ClipboardEvent',
    'DOMParser',
    'Element',
    'Event',
    'File',
    'FileReader',
    'HTMLElement',
    'HTMLInputElement',
    'KeyboardEvent',
    'MouseEvent',
    'MutationObserver',
    'Node',
  ];

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: browser, writable: true },
    document: { configurable: true, value: browser.document, writable: true },
    navigator: { configurable: true, value: browser.navigator, writable: true },
    getComputedStyle: {
      configurable: true,
      value: browser.getComputedStyle.bind(browser),
      writable: true,
    },
    requestAnimationFrame: {
      configurable: true,
      value: browser.requestAnimationFrame.bind(browser),
      writable: true,
    },
    cancelAnimationFrame: {
      configurable: true,
      value: browser.cancelAnimationFrame.bind(browser),
      writable: true,
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
  });
  for (const name of exposedGlobals) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: browser[name],
      writable: true,
    });
  }

  const React = await import(pathToFileURL(join(isolatedNodeModules, 'react/index.js')).href);
  const { createRoot } = await import(
    pathToFileURL(join(isolatedNodeModules, 'react-dom/client.js')).href
  );
  const originalAt = Object.getOwnPropertyDescriptor(Array.prototype, 'at');
  const originalFindLast = Object.getOwnPropertyDescriptor(Array.prototype, 'findLast');
  const nativeAt = originalAt?.value;
  const nativeFindLast = originalFindLast?.value;
  const unscopables = Array.prototype[Symbol.unscopables];
  const originalUnscopablesAt = Object.getOwnPropertyDescriptor(unscopables, 'at');
  const originalUnscopablesFindLast = Object.getOwnPropertyDescriptor(unscopables, 'findLast');
  const distUrl = pathToFileURL(join(isolatedPackage, 'index.js'));

  assert.equal(typeof nativeAt, 'function');
  assert.equal(typeof nativeFindLast, 'function');

  const bigintPrimitive = 0n;
  const bigintObject = Object(0n);
  const bigintPrimitiveObject = { [Symbol.toPrimitive]: () => 0n };
  const atCases = [
    { index: 0, receiver: ['첫째', '둘째'] },
    { index: -1, receiver: ['첫째', '둘째'] },
    { index: Object(-1), receiver: ['첫째', '둘째'] },
    { index: bigintPrimitive, receiver: ['첫째'] },
    { index: bigintObject, receiver: ['첫째'] },
    { index: bigintPrimitiveObject, receiver: ['첫째'] },
  ];
  const findLastCases = [
    { 0: '첫째', 1: '둘째', length: 2 },
    { 0: '첫째', length: Object(1) },
    { 0: '첫째', length: bigintObject },
    { 0: '첫째', length: bigintPrimitiveObject },
  ];
  const nativeAtOutcomes = atCases.map(({ receiver, index }) =>
    captureOutcome(() => nativeAt.call(receiver, index)),
  );
  const nativeFindLastOutcomes = findLastCases.map((receiver) =>
    captureOutcome(() => nativeFindLast.call(receiver, () => true)),
  );

  try {
    await import(`${distUrl.href}?native`);
    assert.equal(Array.prototype.at, nativeAt);
    assert.equal(Array.prototype.findLast, nativeFindLast);
    assert.deepEqual(Object.getOwnPropertyDescriptor(unscopables, 'at'), originalUnscopablesAt);
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(unscopables, 'findLast'),
      originalUnscopablesFindLast,
    );

    delete Array.prototype.at;
    delete Array.prototype.findLast;
    delete unscopables.at;
    delete unscopables.findLast;

    const { HtmlEditor } = await import(`${distUrl.href}?shim`);
    const shimAt = Array.prototype.at;
    const shimFindLast = Array.prototype.findLast;

    assert.equal(typeof shimAt, 'function');
    assert.equal(typeof shimFindLast, 'function');
    assert.equal(shimAt.name, nativeAt.name);
    assert.equal(shimAt.length, nativeAt.length);
    assert.equal(shimFindLast.name, nativeFindLast.name);
    assert.equal(shimFindLast.length, nativeFindLast.length);
    assert.deepEqual(
      descriptorMetadata(Object.getOwnPropertyDescriptor(Array.prototype, 'at')),
      descriptorMetadata(originalAt),
    );
    assert.deepEqual(
      descriptorMetadata(Object.getOwnPropertyDescriptor(Array.prototype, 'findLast')),
      descriptorMetadata(originalFindLast),
    );
    assert.deepEqual(Object.getOwnPropertyDescriptor(unscopables, 'at'), originalUnscopablesAt);
    assert.deepEqual(
      Object.getOwnPropertyDescriptor(unscopables, 'findLast'),
      originalUnscopablesFindLast,
    );

    assert.deepEqual(
      atCases.map(({ receiver, index }) => captureOutcome(() => shimAt.call(receiver, index))),
      nativeAtOutcomes,
    );
    assert.deepEqual(
      findLastCases.map((receiver) =>
        captureOutcome(() => shimFindLast.call(receiver, () => true)),
      ),
      nativeFindLastOutcomes,
    );

    // 추가 인자는 표준 findLast callback의 this가 되지 않는다.
    const ignoredThisArgument = { value: '무시할 추가 인자' };
    let callbackThis;
    assert.equal(
      shimFindLast.call(
        ['첫째'],
        function () {
          callbackThis = this;
          return true;
        },
        ignoredThisArgument,
      ),
      '첫째',
    );
    assert.equal(callbackThis, undefined);

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const ref = React.createRef();
    let latestHtml;

    await React.act(async () => {
      root.render(
        React.createElement(HtmlEditor, {
          ref,
          value: '<p>목록 항목</p>',
          onChange(html) {
            latestHtml = html;
          },
        }),
      );
    });

    assert.match(container.innerHTML, /목록 항목/);
    assert.ok(ref.current);
    await React.act(async () => {
      ref.current.focus();
    });

    const editor = container.querySelector('[contenteditable="true"]');
    assert.ok(editor);
    assert.equal(document.activeElement, editor);

    const listButton = container.querySelector('button[aria-label="글머리 목록"]');
    assert.ok(listButton);
    await React.act(async () => {
      listButton.click();
    });

    assert.match(latestHtml ?? '', /<ul>/);

    const listText = editor.querySelector('li p')?.firstChild;
    assert.equal(listText?.nodeType, Node.TEXT_NODE);
    const inputData = ' 입력';
    await React.act(async () => {
      const range = document.createRange();
      range.setStart(listText, listText.data.length);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      const beforeInput = new browser.InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        data: inputData,
        inputType: 'insertText',
      });
      assert.equal(editor.dispatchEvent(beforeInput), true);
      listText.insertData(listText.data.length, inputData);
      editor.dispatchEvent(
        new browser.InputEvent('input', {
          bubbles: true,
          data: inputData,
          inputType: 'insertText',
        }),
      );
    });

    assert.equal(latestHtml, '<ul><li><p>목록 항목 입력</p></li></ul><p></p>');

    await React.act(async () => {
      root.unmount();
    });
    assert.equal(container.innerHTML, '');
    container.remove();
  } finally {
    if (originalAt) {
      Object.defineProperty(Array.prototype, 'at', originalAt);
    } else {
      delete Array.prototype.at;
    }
    if (originalFindLast) {
      Object.defineProperty(Array.prototype, 'findLast', originalFindLast);
    } else {
      delete Array.prototype.findLast;
    }
    if (originalUnscopablesAt) {
      Object.defineProperty(unscopables, 'at', originalUnscopablesAt);
    } else {
      delete unscopables.at;
    }
    if (originalUnscopablesFindLast) {
      Object.defineProperty(unscopables, 'findLast', originalUnscopablesFindLast);
    } else {
      delete unscopables.findLast;
    }
    browser.close();
    await rm(isolatedRoot, { recursive: true, force: true });
    process.removeListener('exit', cleanupIsolatedRoot);
  }

  console.log(`${label} dist runtime 호환성 검사 통과`);
}

for (const scenario of runtimeScenarios) {
  await runRuntimeScenario(scenario);
}
console.log('Chrome 85 runtime 호환성 검사 통과');
