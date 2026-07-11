# Schemas and definitions

This directory will own versioned schemas for canonical game definitions, command inputs, runtime envelopes, and reports. Schemas establish field types, units, ranges, compatibility rules, and stable validation error codes.

Authored definitions will be validated before simulation, persistence, or runtime launch. Godot may consume the validated representation but may not silently redefine it through scene or resource defaults. No concrete schema is added until Movement Editor v0.1 defines and tests its first format.
