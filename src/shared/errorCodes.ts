export const ErrorCodes = {
  MovementFileNotFound: "MOVEMENT_FILE_NOT_FOUND",
  MovementFileReadFailed: "MOVEMENT_FILE_READ_FAILED",
  MovementJsonInvalid: "MOVEMENT_JSON_INVALID",
  MovementSchemaInvalid: "MOVEMENT_SCHEMA_INVALID",
  MovementSchemaVersionUnsupported: "MOVEMENT_SCHEMA_VERSION_UNSUPPORTED",
  MovementSpeedOrderInvalid: "MOVEMENT_SPEED_ORDER_INVALID",
  MovementAccelerationInvalid: "MOVEMENT_ACCELERATION_INVALID",
  MovementDecelerationInvalid: "MOVEMENT_DECELERATION_INVALID",
  MovementRotationInvalid: "MOVEMENT_ROTATION_INVALID",
  MovementStaminaInvalid: "MOVEMENT_STAMINA_INVALID",
  MovementDodgeInvalid: "MOVEMENT_DODGE_INVALID",
  MovementDodgeIframeWindowInvalid: "MOVEMENT_DODGE_IFRAME_WINDOW_INVALID",
  MovementPropertyNotFound: "MOVEMENT_PROPERTY_NOT_FOUND",
  MovementPropertyValueInvalid: "MOVEMENT_PROPERTY_VALUE_INVALID",
  MovementWriteBlocked: "MOVEMENT_WRITE_BLOCKED",
  SnapshotNotFound: "SNAPSHOT_NOT_FOUND",
  SnapshotRollbackFailed: "SNAPSHOT_ROLLBACK_FAILED",
  CliArgumentInvalid: "CLI_ARGUMENT_INVALID",
  InternalError: "INTERNAL_ERROR"
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
