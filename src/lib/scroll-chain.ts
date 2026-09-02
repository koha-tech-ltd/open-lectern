/** Chrome keeps wheel events inside overflow:auto even at the boundary. */

const EDGE = 1;

function overflowY(el: Element): string {
  return getComputedStyle(el).overflowY;
}

function isYScrollable(el: HTMLElement): boolean {
  const y = overflowY(el);
  if (y !== 'auto' && y !== 'scroll' && y !== 'overlay') return false;
  return el.scrollHeight - el.clientHeight > EDGE;
}

function canScrollY(el: HTMLElement, deltaY: number): boolean {
  if (!isYScrollable(el)) return false;
  if (deltaY > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - EDGE;
  if (deltaY < 0) return el.scrollTop > EDGE;
  return false;
}

function wheelDeltaY(event: WheelEvent): number {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

function scrollablesFromTarget(target: EventTarget | null, root: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let node: HTMLElement | null = target instanceof HTMLElement ? target : null;
  while (node) {
    if (isYScrollable(node)) chain.push(node);
    if (node === root) break;
    node = node.parentElement;
  }
  if (isYScrollable(root) && chain[chain.length - 1] !== root) chain.push(root);
  return chain;
}

function scrollPageBy(deltaY: number): void {
  const page = document.scrollingElement;
  if (page) {
    page.scrollTop += deltaY;
    return;
  }
  window.scrollBy(0, deltaY);
}

/** When nested overflow is at its edge, continue scrolling the next ancestor, then the page. */
export function attachNestedScrollChain(root: HTMLElement): () => void {
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.defaultPrevented) return;
    const deltaY = wheelDeltaY(event);
    if (deltaY === 0 || Math.abs(deltaY) < Math.abs(event.deltaX)) return;

    const chain = scrollablesFromTarget(event.target, root);
    const absorber = chain.find((el) => canScrollY(el, deltaY));

    if (absorber && absorber === chain[0]) return;

    event.preventDefault();
    if (absorber) {
      absorber.scrollTop += deltaY;
      return;
    }
    scrollPageBy(deltaY);
  };

  root.addEventListener('wheel', onWheel, { passive: false });
  return () => root.removeEventListener('wheel', onWheel);
}
