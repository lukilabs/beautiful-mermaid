/** Tagged template literal function that rounds floats, keep other values untouched */
export function f(strings: TemplateStringsArray, ...values: any[]) {
  return String.raw(
    { raw: strings },
    ...values.map((v) => (typeof v === 'number' ? Number(v.toFixed(2)) : v)),
  );
}
