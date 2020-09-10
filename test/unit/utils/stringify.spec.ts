import * as fc from '../../../lib/fast-check';

// The package is an alias for 'buffer', the most used polyfill for Buffer in the browser
import { Buffer as NotNodeBuffer } from '@buffer';

import { asyncStringify, stringify } from '../../../src/utils/stringify';

declare function BigInt(n: number | bigint | string): bigint;

const checkEqual = (a: any, b: any): boolean => {
  try {
    expect(a).toEqual(b);
    return true;
  } catch (err) {
    return false;
  }
};

class ThrowingToString {
  toString() {
    throw new Error('No toString');
  }
}

class CustomTagThrowingToString {
  [Symbol.toStringTag] = 'CustomTagThrowingToString';
  toString() {
    throw new Error('No toString');
  }
}

const anythingEnableAll = {
  withBoxedValues: true,
  withMap: true,
  withSet: true,
  withObjectString: true,
  withNullPrototype: true,
  ...(typeof BigInt !== 'undefined' ? { withBigInt: true } : {}),
};

describe('stringify', () => {
  it('Should be able to stringify fc.anything()', () =>
    fc.assert(fc.property(fc.anything(anythingEnableAll), (a) => typeof stringify(a) === 'string')));
  it('Should be able to stringify fc.char16bits() (ie. possibly invalid strings)', () =>
    fc.assert(fc.property(fc.char16bits(), (a) => typeof stringify(a) === 'string')));
  if (typeof BigInt !== 'undefined') {
    it('Should be able to stringify bigint in object correctly', () =>
      fc.assert(fc.property(fc.bigInt(), (b) => stringify({ b }) === '{"b":' + b + 'n}')));
  }
  it('Should be equivalent to JSON.stringify for JSON compliant objects', () =>
    fc.assert(
      fc.property(
        fc.anything({ values: [fc.boolean(), fc.integer(), fc.double(), fc.fullUnicodeString(), fc.constant(null)] }),
        (obj) => {
          expect(stringify(obj)).toEqual(JSON.stringify(obj));
        }
      )
    ));
  it('Should be readable from eval', () =>
    fc.assert(
      fc.property(fc.anything(anythingEnableAll), (obj) => {
        expect(eval(`(function() { return ${stringify(obj)}; })()`)).toStrictEqual(obj as any);
      })
    ));
  it('Should stringify differently distinct objects', () =>
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (a, b) => {
        fc.pre(!checkEqual(a, b));
        expect(stringify(a)).not.toEqual(stringify(b));
      })
    ));
  it('Should be able to stringify cyclic object', () => {
    const cyclic: any = { a: 1, b: 2, c: 3 };
    cyclic.b = cyclic;
    const repr = stringify(cyclic);
    expect(repr).toContain('"a"');
    expect(repr).toContain('"b"');
    expect(repr).toContain('"c"');
    expect(repr).toContain('[cyclic]');
    expect(repr).toEqual('{"a":1,"b":[cyclic],"c":3}');
  });
  it('Should be able to stringify cyclic arrays', () => {
    const cyclic: any[] = [1, 2, 3];
    cyclic.push(cyclic);
    cyclic.push(4);
    const repr = stringify(cyclic);
    expect(repr).toEqual('[1,2,3,[cyclic],4]');
  });
  it('Should be able to stringify cyclic sets', () => {
    const cyclic: Set<any> = new Set([1, 2, 3]);
    cyclic.add(cyclic);
    cyclic.add(4);
    const repr = stringify(cyclic);
    expect(repr).toEqual('new Set([1,2,3,[cyclic],4])');
  });
  it('Should be able to stringify cyclic maps', () => {
    const cyclic: Map<any, any> = new Map();
    cyclic.set(1, 2);
    cyclic.set(3, cyclic);
    cyclic.set(cyclic, 4);
    cyclic.set(5, 6);
    const repr = stringify(cyclic);
    expect(repr).toEqual('new Map([[1,2],[3,[cyclic]],[[cyclic],4],[5,6]])');
  });
  it('Should be able to stringify values', () => {
    expect(stringify(null)).toEqual('null');
    expect(stringify(undefined)).toEqual('undefined');
    expect(stringify(false)).toEqual('false');
    expect(stringify(42)).toEqual('42');
    expect(stringify(-0)).toEqual('-0');
    expect(stringify(Number.POSITIVE_INFINITY)).toEqual('Number.POSITIVE_INFINITY');
    expect(stringify(Number.NEGATIVE_INFINITY)).toEqual('Number.NEGATIVE_INFINITY');
    expect(stringify(Number.NaN)).toEqual('Number.NaN');
    expect(stringify('Hello')).toEqual('"Hello"');
    if (typeof BigInt !== 'undefined') {
      expect(stringify(BigInt(42))).toEqual('42n');
    }
  });
  it('Should be able to stringify boxed values', () => {
    expect(stringify(new Boolean(false))).toEqual('new Boolean(false)');
    expect(stringify(new Number(42))).toEqual('new Number(42)');
    expect(stringify(new Number(-0))).toEqual('new Number(-0)');
    expect(stringify(new Number(Number.POSITIVE_INFINITY))).toEqual('new Number(Number.POSITIVE_INFINITY)');
    expect(stringify(new Number(Number.NEGATIVE_INFINITY))).toEqual('new Number(Number.NEGATIVE_INFINITY)');
    expect(stringify(new Number(Number.NaN))).toEqual('new Number(Number.NaN)');
    expect(stringify(new String('Hello'))).toEqual('new String("Hello")');
  });
  it('Should be able to stringify Date', () => {
    expect(stringify(new Date(NaN))).toEqual('new Date(NaN)');
    expect(stringify(new Date('2014-25-23'))).toEqual('new Date(NaN)');
    expect(stringify(new Date('2019-05-23T22:19:06.049Z'))).toEqual('new Date("2019-05-23T22:19:06.049Z")');
  });
  it('Should be able to stringify Set', () => {
    expect(stringify(new Set([1, 2]))).toEqual('new Set([1,2])');
  });
  it('Should be able to stringify Map', () => {
    expect(stringify(new Map([[1, 2]]))).toEqual('new Map([[1,2]])');
  });
  it('Should be able to stringify Symbol', () => {
    expect(stringify(Symbol())).toEqual('Symbol()');
    expect(stringify(Symbol('fc'))).toEqual('Symbol("fc")');
    expect(stringify(Symbol.for('fc'))).toEqual('Symbol.for("fc")');
  });
  it('Should be able to stringify Object without prototype', () => {
    expect(stringify(Object.create(null))).toEqual('Object.create(null)');
    expect(stringify(Object.assign(Object.create(null), { a: 1 }))).toEqual(
      'Object.assign(Object.create(null),{"a":1})'
    );
  });
  it('Should be able to stringify Object with custom __proto__ value', () => {
    expect(stringify({ ['__proto__']: 1 })).toEqual('{["__proto__"]:1}');
    // NOTE: {__proto__: 1} and {'__proto__': 1} are not the same as {['__proto__']: 1}
  });
  it('Should be able to stringify Promise but not show its value or status in sync mode', () => {
    const p1 = Promise.resolve(1); // resolved
    const p2 = Promise.reject(1); // rejected
    const p3 = new Promise(() => {}); // unresolved (ie pending)

    expect(stringify(p1)).toEqual('new Promise(() => {/*unknown*/})');
    expect(stringify(p2)).toEqual('new Promise(() => {/*unknown*/})');
    expect(stringify(p3)).toEqual('new Promise(() => {/*unknown*/})');
    expect(stringify({ p1 })).toEqual('{"p1":new Promise(() => {/*unknown*/})}');

    [p1, p2, p3].map((p) => p.catch(() => {})); // no unhandled rejections
  });
  it('Should be able to stringify Buffer', () => {
    expect(stringify(Buffer.from([1, 2, 3, 4]))).toEqual('Buffer.from([1,2,3,4])');
    expect(stringify(Buffer.alloc(3))).toEqual('Buffer.from([0,0,0])');
    expect(stringify(Buffer.alloc(4, 'a'))).toEqual('Buffer.from([97,97,97,97])');
    fc.assert(
      fc.property(fc.array(fc.nat(255)), (data) => {
        const buffer = Buffer.from(data);
        const stringifiedBuffer = stringify(buffer);
        const bufferFromStringified = eval(stringifiedBuffer);
        return Buffer.isBuffer(bufferFromStringified) && buffer.equals(bufferFromStringified);
      })
    );
  });
  it('Should be able to stringify a polyfill-ed Buffer', () => {
    const buffer = NotNodeBuffer.from([1, 2, 3, 4]);
    expect(NotNodeBuffer).not.toBe(Buffer);
    expect(buffer instanceof NotNodeBuffer).toBe(true);
    expect(buffer instanceof Buffer).toBe(false);
    expect(stringify(buffer)).toEqual('Buffer.from([1,2,3,4])');
  });
  it('Should be able to stringify Int8Array', () => {
    expect(stringify(Int8Array.from([-128, 5, 127]))).toEqual('Int8Array.from([-128,5,127])');
    assertStringifyTypedArraysProperly(fc.integer(-128, 127), Int8Array.from.bind(Int8Array));
  });
  it('Should be able to stringify Uint8Array', () => {
    expect(stringify(Uint8Array.from([255, 0, 5, 127]))).toEqual('Uint8Array.from([255,0,5,127])');
    assertStringifyTypedArraysProperly(fc.integer(0, 255), Uint8Array.from.bind(Uint8Array));
  });
  it('Should be able to stringify Int16Array', () => {
    expect(stringify(Int16Array.from([-32768, 5, 32767]))).toEqual('Int16Array.from([-32768,5,32767])');
    assertStringifyTypedArraysProperly(fc.integer(-32768, 32767), Int16Array.from.bind(Int16Array));
  });
  it('Should be able to stringify Uint16Array', () => {
    expect(stringify(Uint16Array.from([65535, 0, 5, 32767]))).toEqual('Uint16Array.from([65535,0,5,32767])');
    assertStringifyTypedArraysProperly(fc.integer(0, 65535), Uint16Array.from.bind(Uint16Array));
  });
  it('Should be able to stringify Int32Array', () => {
    expect(stringify(Int32Array.from([-2147483648, 5, 2147483647]))).toEqual(
      'Int32Array.from([-2147483648,5,2147483647])'
    );
    assertStringifyTypedArraysProperly(fc.integer(-2147483648, 2147483647), Int32Array.from.bind(Int32Array));
  });
  it('Should be able to stringify Uint32Array', () => {
    expect(stringify(Uint32Array.from([4294967295, 0, 5, 2147483647]))).toEqual(
      'Uint32Array.from([4294967295,0,5,2147483647])'
    );
    assertStringifyTypedArraysProperly(fc.integer(0, 4294967295), Uint32Array.from.bind(Uint32Array));
  });
  it('Should be able to stringify Float32Array', () => {
    expect(stringify(Float32Array.from([0, 0.5, 30, -1]))).toEqual('Float32Array.from([0,0.5,30,-1])');
    assertStringifyTypedArraysProperly(fc.float(), Float32Array.from.bind(Float32Array));
  });
  it('Should be able to stringify Float64Array', () => {
    expect(stringify(Float64Array.from([0, 0.5, 30, -1]))).toEqual('Float64Array.from([0,0.5,30,-1])');
    assertStringifyTypedArraysProperly(fc.double(), Float64Array.from.bind(Float64Array));
  });
  if (typeof BigInt !== 'undefined') {
    it('Should be able to stringify BigInt64Array', () => {
      expect(stringify(BigInt64Array.from([BigInt(-2147483648), BigInt(5), BigInt(2147483647)]))).toEqual(
        'BigInt64Array.from([-2147483648n,5n,2147483647n])'
      );
      assertStringifyTypedArraysProperly<bigint>(fc.bigIntN(64), BigInt64Array.from.bind(BigInt64Array));
    });
    it('Should be able to stringify BigUint64Array', () => {
      expect(stringify(BigUint64Array.from([BigInt(0), BigInt(5), BigInt(2147483647)]))).toEqual(
        'BigUint64Array.from([0n,5n,2147483647n])'
      );
      assertStringifyTypedArraysProperly<bigint>(fc.bigUintN(64), BigUint64Array.from.bind(BigUint64Array));
    });
  }
  it('Should be only produce toStringTag for failing toString', () => {
    expect(stringify(new ThrowingToString())).toEqual('[object Object]');
    expect(stringify(new CustomTagThrowingToString())).toEqual('[object CustomTagThrowingToString]');
    // TODO Move to getter-based implementation instead - es5 required
    const instance = Object.create(null);
    Object.defineProperty(instance, 'toString', {
      get: () => {
        throw new Error('No such accessor');
      },
    });
    expect(stringify(instance)).toEqual('[object Object]');
  });
});

describe('asyncStringify', () => {
  it('Should be able to stringify resolved Promise', async () => {
    const p = Promise.resolve(1);
    expect(await asyncStringify(p)).toEqual('Promise.resolve(1)');
  });
  it('Should be able to stringify rejected Promise', async () => {
    const p = Promise.reject(1);
    expect(await asyncStringify(p)).toEqual('Promise.reject(1)');
    p.catch(() => {}); // no unhandled rejections
  });
  it('Should be able to stringify rejected Promise with Error', async () => {
    const p = Promise.reject(new Error('message'));
    expect(await asyncStringify(p)).toEqual('Promise.reject(new Error("message"))');
    p.catch(() => {}); // no unhandled rejections
  });
  it('Should be able to stringify pending Promise', async () => {
    const p = new Promise(() => {});
    expect(await asyncStringify(p)).toEqual('new Promise(() => {/*pending*/})');
  });
  it('Should be able to stringify Promise in other instances', async () => {
    const p1 = Promise.resolve(1);
    expect(await asyncStringify([p1])).toEqual('[Promise.resolve(1)]');
    expect(await asyncStringify(new Set([p1]))).toEqual('new Set([Promise.resolve(1)])');
    expect(await asyncStringify({ p1 })).toEqual('{"p1":Promise.resolve(1)}');
  });
  it('Should be able to stringify nested Promise', async () => {
    const nestedPromises = Promise.resolve({
      lvl1: Promise.resolve({
        lvl2: Promise.resolve(2),
      }),
    });
    expect(await asyncStringify(nestedPromises)).toEqual(
      'Promise.resolve({"lvl1":Promise.resolve({"lvl2":Promise.resolve(2)})})'
    );
  });
});

// Helpers

function assertStringifyTypedArraysProperly<TNumber>(
  arb: fc.Arbitrary<TNumber>,
  typedArrayProducer: (data: TNumber[]) => { values: () => IterableIterator<TNumber>; [Symbol.toStringTag]: string }
): void {
  fc.assert(
    fc.property(fc.array(arb), (data) => {
      const typedArray = typedArrayProducer(data);
      const stringifiedTypedArray = stringify(typedArray);
      const typedArrayFromStringified: typeof typedArray = eval(stringifiedTypedArray);
      expect(typedArrayFromStringified[Symbol.toStringTag]).toEqual(typedArray[Symbol.toStringTag]);
      expect([...typedArrayFromStringified.values()]).toEqual([...typedArray.values()]);
    })
  );
}
