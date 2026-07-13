import { stat } from "node:fs/promises";
import path from "node:path";

export const PACKAGE_ASSET_NOT_FOUND = "PACKAGE_ASSET_NOT_FOUND";

export class PackageAssetResolutionError extends Error {
  readonly code = PACKAGE_ASSET_NOT_FOUND;

  constructor(public readonly relativePath: string, public readonly packageRoot: string) {
    super(`Required mam-engine package asset '${relativePath}' was not found`);
  }
}

export interface ResolvedPackageAsset {
  packageRoot: string;
  relativePath: string;
  path: string;
}

export async function resolvePackageAsset(relativePath: string, moduleDirectory = __dirname): Promise<ResolvedPackageAsset> {
  const packageRoot = path.resolve(moduleDirectory, "../../../..");
  const normalized = relativePath.replaceAll("\\", "/");
  const assetPath = path.resolve(packageRoot, ...normalized.split("/"));
  if (assetPath !== packageRoot && !assetPath.startsWith(`${packageRoot}${path.sep}`)) {
    throw new PackageAssetResolutionError(normalized, packageRoot);
  }
  try {
    if (!(await stat(assetPath)).isFile()) throw new Error("not a file");
  } catch {
    throw new PackageAssetResolutionError(normalized, packageRoot);
  }
  return { packageRoot, relativePath: normalized, path: assetPath };
}
