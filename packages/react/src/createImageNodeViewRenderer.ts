import type { NodeViewRenderer } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';

const MIN_IMAGE_WIDTH = 32;
const MAX_IMAGE_WIDTH = 10_000;

type ImageAlignment = 'left' | 'center' | 'right';

type DragSession = {
  node: Parameters<NodeViewRenderer>[0]['node'];
  pointerId: number;
  position: number;
  startClientX: number;
  startNodeWidth: number | null;
  startRenderedWidth: number;
};

function editorContentWidth(element: HTMLElement): number {
  const width = element.getBoundingClientRect().width;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  const horizontalEdges = [
    style?.paddingLeft,
    style?.paddingRight,
    style?.borderLeftWidth,
    style?.borderRightWidth,
  ].reduce((total, value) => {
    const pixels = Number.parseFloat(value ?? '0');

    return total + (Number.isFinite(pixels) ? pixels : 0);
  }, 0);

  return Math.max(0, width - horizontalEdges);
}

function applyAlignment(element: HTMLElement, alignment: ImageAlignment): void {
  element.style.marginLeft = alignment === 'left' ? '0' : 'auto';
  element.style.marginRight = alignment === 'right' ? '0' : 'auto';
}

/** React package가 소유하는 private image NodeView renderer를 만든다. */
export function createImageNodeViewRenderer(): NodeViewRenderer {
  return ({ node: initialNode, view, getPos }) => {
    let node = initialNode;
    let selected = false;
    let loaded = false;
    let destroyed = false;
    let dragSession: DragSession | null = null;

    const wrapper = document.createElement('span');
    wrapper.className = 'simple-html-editor__image';
    wrapper.contentEditable = 'false';

    const image = document.createElement('img');
    image.draggable = false;

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'simple-html-editor__image-resize-handle';
    handle.setAttribute('aria-label', '이미지 크기 조절');
    handle.contentEditable = 'false';

    const currentPosition = (): number | null => {
      const position = getPos();

      return typeof position === 'number' ? position : null;
    };

    const isCurrentSelection = (): boolean => {
      const position = currentPosition();
      const selection = view.state.selection;

      return (
        position !== null &&
        selection instanceof NodeSelection &&
        selection.from === position &&
        view.state.doc.nodeAt(position) === node
      );
    };

    const refreshHandle = (): void => {
      if (destroyed) {
        return;
      }

      const selectedNow = selected && isCurrentSelection();
      const handleVisible =
        selectedNow &&
        view.editable &&
        loaded &&
        image.getBoundingClientRect().width > 0 &&
        editorContentWidth(view.dom) >= MIN_IMAGE_WIDTH;

      wrapper.classList.toggle('simple-html-editor__image--selected', selectedNow);

      if (handleVisible && handle.parentNode !== wrapper) {
        wrapper.append(handle);
      } else if (!handleVisible) {
        handle.remove();
      }
    };

    const restoreNodeWidth = (): void => {
      wrapper.style.width =
        typeof node.attrs.width === 'number' ? `${node.attrs.width}px` : 'fit-content';
    };

    const releaseCapture = (pointerId: number): void => {
      try {
        if (
          typeof handle.releasePointerCapture === 'function' &&
          (typeof handle.hasPointerCapture !== 'function' || handle.hasPointerCapture(pointerId))
        ) {
          handle.releasePointerCapture(pointerId);
        }
      } catch {
        // capture가 이미 해제된 cleanup 경쟁은 문서 변경 없이 끝낸다.
      }
    };

    const cancelDrag = (): void => {
      const session = dragSession;

      if (!session) {
        return;
      }

      dragSession = null;
      restoreNodeWidth();
      releaseCapture(session.pointerId);
    };

    const clampedWidth = (session: DragSession, clientX: number): number | null => {
      const maximum = Math.min(MAX_IMAGE_WIDTH, Math.floor(editorContentWidth(view.dom)));

      if (maximum < MIN_IMAGE_WIDTH) {
        return null;
      }

      const candidate = Math.round(session.startRenderedWidth + (clientX - session.startClientX));

      return Math.min(maximum, Math.max(MIN_IMAGE_WIDTH, candidate));
    };

    const renderNode = (): void => {
      const { src, alt, width, alignment } = node.attrs;
      image.src = typeof src === 'string' ? src : '';

      if (typeof alt === 'string') {
        image.alt = alt;
      } else {
        image.removeAttribute('alt');
      }

      wrapper.style.width = typeof width === 'number' ? `${width}px` : 'fit-content';
      wrapper.style.maxWidth = '100%';
      applyAlignment(wrapper, alignment === 'center' || alignment === 'right' ? alignment : 'left');
      refreshHandle();
    };

    const selectImage = (event: PointerEvent): void => {
      if (event.button !== 0 || !event.isPrimary || !view.editable) {
        return;
      }

      const position = currentPosition();

      if (position === null || view.state.doc.nodeAt(position) !== node) {
        return;
      }

      event.preventDefault();
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position)));
      view.focus();
    };

    const markLoaded = (): void => {
      loaded = true;
      refreshHandle();
    };

    const startDrag = (event: PointerEvent): void => {
      if (
        dragSession ||
        event.button !== 0 ||
        !event.isPrimary ||
        !view.editable ||
        !selected ||
        !isCurrentSelection()
      ) {
        return;
      }

      const position = currentPosition();
      const startRenderedWidth = image.getBoundingClientRect().width;
      const maximum = Math.min(MAX_IMAGE_WIDTH, Math.floor(editorContentWidth(view.dom)));

      if (
        position === null ||
        startRenderedWidth <= 0 ||
        maximum < MIN_IMAGE_WIDTH ||
        typeof handle.setPointerCapture !== 'function'
      ) {
        return;
      }

      event.preventDefault();

      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        return;
      }

      dragSession = {
        node,
        pointerId: event.pointerId,
        position,
        startClientX: event.clientX,
        startNodeWidth: typeof node.attrs.width === 'number' ? node.attrs.width : null,
        startRenderedWidth,
      };
    };

    const previewDrag = (event: PointerEvent): void => {
      const session = dragSession;

      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      if (!view.editable || !isCurrentSelection()) {
        cancelDrag();
        return;
      }

      const width = clampedWidth(session, event.clientX);

      if (width === null) {
        cancelDrag();
        refreshHandle();
        return;
      }

      event.preventDefault();
      wrapper.style.width = `${width}px`;
    };

    const finishDrag = (event: PointerEvent): void => {
      const session = dragSession;

      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      const width = clampedWidth(session, event.clientX);
      const currentNode = view.state.doc.nodeAt(session.position);
      const canCommit =
        width !== null &&
        view.editable &&
        isCurrentSelection() &&
        node === session.node &&
        currentNode === node;

      dragSession = null;
      releaseCapture(session.pointerId);

      if (!canCommit || width === null) {
        restoreNodeWidth();
        refreshHandle();
        return;
      }

      wrapper.style.width = `${width}px`;

      if (session.startNodeWidth === width) {
        return;
      }

      view.dispatch(
        view.state.tr.setNodeMarkup(session.position, undefined, {
          ...node.attrs,
          width,
        }),
      );
    };

    const cancelPointer = (event: PointerEvent): void => {
      if (dragSession?.pointerId === event.pointerId) {
        cancelDrag();
      }
    };

    const losePointerCapture = (event: PointerEvent): void => {
      if (dragSession?.pointerId === event.pointerId) {
        cancelDrag();
      }
    };

    image.addEventListener('pointerdown', selectImage);
    image.addEventListener('load', markLoaded);
    handle.addEventListener('pointerdown', startDrag);
    handle.addEventListener('pointermove', previewDrag);
    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', cancelPointer);
    handle.addEventListener('lostpointercapture', losePointerCapture);
    wrapper.append(image);
    renderNode();

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (dragSession && editorContentWidth(view.dom) < MIN_IMAGE_WIDTH) {
              cancelDrag();
            }
            refreshHandle();
          });
    resizeObserver?.observe(view.dom);

    return {
      dom: wrapper,
      selectNode() {
        selected = true;
        refreshHandle();
      },
      deselectNode() {
        cancelDrag();
        selected = false;
        refreshHandle();
      },
      update(updatedNode) {
        if (updatedNode.type !== node.type) {
          return false;
        }

        if (dragSession && updatedNode !== node) {
          cancelDrag();
        }

        if (updatedNode.attrs.src !== node.attrs.src) {
          loaded = false;
        }

        node = updatedNode;
        renderNode();
        return true;
      },
      stopEvent(event) {
        return event.target === image || event.target === handle;
      },
      ignoreMutation() {
        return true;
      },
      destroy() {
        cancelDrag();
        destroyed = true;
        resizeObserver?.disconnect();
        image.removeEventListener('pointerdown', selectImage);
        image.removeEventListener('load', markLoaded);
        handle.removeEventListener('pointerdown', startDrag);
        handle.removeEventListener('pointermove', previewDrag);
        handle.removeEventListener('pointerup', finishDrag);
        handle.removeEventListener('pointercancel', cancelPointer);
        handle.removeEventListener('lostpointercapture', losePointerCapture);
        handle.remove();
      },
    };
  };
}
