export interface GodotVersionInfo {
  reportedVersion: string;
  major: number;
  minor: number;
  patch: number | null;
  channel: string;
  compatible: boolean;
}

export function parseGodotVersion(output: string): GodotVersionInfo | null {
  const reportedVersion = output.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?\.([A-Za-z0-9_]+)(?:\.|$)/.exec(reportedVersion);
  if (!match) return null;
  const channel = (match[4] ?? "").toLowerCase();
  const compatible = Number(match[1]) === 4 && Number(match[2]) === 7 && channel === "stable" && !/(dev|alpha|beta|rc)/i.test(reportedVersion);
  return { reportedVersion, major: Number(match[1]), minor: Number(match[2]), patch: match[3] === undefined ? null : Number(match[3]), channel, compatible };
}
