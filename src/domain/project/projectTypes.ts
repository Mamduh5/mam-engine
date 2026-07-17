export interface MamProjectManifest {
  schemaVersion: 1;
  kind: "mam-project";
  id: string;
  displayName: string;
  definitionRoot: string;
  entryMovementFile: string | null;
  entryCameraFile?: string | null;
  entryTargetingFile?: string | null;
}

export interface ProjectValidationFinding {
  code: string;
  message: string;
  path?: string;
  file?: string;
}
