export type AmdpOk<T> = { ok: true } & T;
export type AmdpErr = { ok: false; error: string };
export type AmdpResult<T> = AmdpOk<T> | AmdpErr;

export function ok<T>(value: T): AmdpOk<T> {
  return { ok: true, ...value };
}

export function err(error: string): AmdpErr {
  return { ok: false, error };
}
