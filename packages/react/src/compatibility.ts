const MAX_SAFE_LENGTH = 9_007_199_254_740_991;

type ArrayPrototypeCompatibility = {
  at?: unknown;
  findLast?: unknown;
};

function toIntegerOrInfinity(value: unknown): number {
  // Unary plus는 ToPrimitive(number) 다음 ToNumber를 수행하므로 BigInt wrapper도 거부한다.
  const number = +(value as number);

  if (Number.isNaN(number) || number === 0) {
    return 0;
  }
  if (!Number.isFinite(number)) {
    return number;
  }
  return Math.trunc(number);
}

function toLength(value: unknown): number {
  return Math.min(Math.max(toIntegerOrInfinity(value), 0), MAX_SAFE_LENGTH);
}

function toArrayLike(value: unknown): Record<number | 'length', unknown> {
  if (value === null || value === undefined) {
    throw new TypeError('Array method called on null or undefined');
  }

  return Object(value) as Record<number | 'length', unknown>;
}

const arrayPrototype = Array.prototype as unknown as ArrayPrototypeCompatibility;

function markUnscopable(method: 'at' | 'findLast'): void {
  const prototype = Array.prototype as unknown as Record<symbol, Record<string, unknown>>;
  let unscopables = prototype[Symbol.unscopables];

  if (!unscopables) {
    unscopables = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(Array.prototype, Symbol.unscopables, {
      configurable: true,
      enumerable: false,
      value: unscopables,
      writable: false,
    });
  }

  Object.defineProperty(unscopables, method, {
    configurable: true,
    enumerable: true,
    value: true,
    writable: true,
  });
}

// 지원 브라우저에 없는 표준 메서드만 조건부로 채운다. 기존 브라우저 구현은 변경하지 않는다.
if (typeof arrayPrototype.at !== 'function') {
  function at(this: unknown, index: number) {
    const object = toArrayLike(this);
    const length = toLength(object.length);
    const relativeIndex = toIntegerOrInfinity(index);
    const actualIndex = relativeIndex >= 0 ? relativeIndex : length + relativeIndex;

    return actualIndex < 0 || actualIndex >= length ? undefined : object[actualIndex];
  }
  Object.defineProperty(at, 'name', { configurable: true, value: 'at' });

  Object.defineProperty(Array.prototype, 'at', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: at,
  });
  markUnscopable('at');
}

if (typeof arrayPrototype.findLast !== 'function') {
  function findLast(
    this: unknown,
    predicate: (value: unknown, index: number, object: unknown) => unknown,
  ) {
    const object = toArrayLike(this);
    const length = toLength(object.length);

    if (typeof predicate !== 'function') {
      throw new TypeError('Array.prototype.findLast predicate must be a function');
    }

    for (let index = length - 1; index >= 0; index -= 1) {
      const value = object[index];
      if (predicate.call(undefined, value, index, object)) {
        return value;
      }
    }

    return undefined;
  }
  Object.defineProperty(findLast, 'name', { configurable: true, value: 'findLast' });

  Object.defineProperty(Array.prototype, 'findLast', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: findLast,
  });
  markUnscopable('findLast');
}
