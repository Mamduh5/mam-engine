import path from "node:path";

const targetQueues = new Map<string, Promise<void>>();

export async function withTargetOperationLock<T>(
  workspaceRoot: string,
  targetRelativePath: string,
  operation: () => Promise<T>
): Promise<T> {
  const key = `${path.resolve(workspaceRoot)}::${targetRelativePath.toLowerCase()}`;
  const previous = targetQueues.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  targetQueues.set(key, current);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (targetQueues.get(key) === current) {
      targetQueues.delete(key);
    }
  }
}
