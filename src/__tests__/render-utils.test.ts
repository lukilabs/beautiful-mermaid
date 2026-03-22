import { describe, it, expect } from 'bun:test';
import { f } from '../render-utils';

describe('f tagged template literal', () => {
  it('rounds floats to 2 decimal places', () => {
    expect(f`${3.14159}`).toBe('3.14');
    expect(f`${0.1 + 0.2}`).toBe('0.3');
    expect(f`${1.005}`).toBe('1');
    expect(f`${1.1}`).toBe('1.1');
    expect(f`${2.0}`).toBe('2');
    expect(f`M ${'A'} ${3.14159} L ${10.5} ${-20.999}`).toBe('M A 3.14 L 10.5 -21');
  });

  it('keeps integers unchanged', () => {
    expect(f`${42}`).toBe('42');
    expect(f`${0}`).toBe('0');
    expect(f`${-7}`).toBe('-7');
  });

  it('passes other values strings as-is', () => {
    expect(f`hello ${'world'}`).toBe('hello world');
    expect(f`${'foo'}bar`).toBe('foobar');
    expect(f`just text`).toBe('just text');
    expect(f`${true}`).toBe('true');
    expect(f`${null}`).toBe('null');
    expect(f`${undefined}`).toBe('undefined');
  });
});
