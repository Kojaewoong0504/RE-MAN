# Incident: Mobile HEIC Upload Fell Back To Non-Preview State

## Symptom

Mobile photo upload showed "미리보기는 어렵지만 분석은 가능합니다." after selecting a photo.

## Root Cause

The previous fix treated browser image decode failure as an acceptable raw-upload fallback. That kept the file from being discarded, but it exposed an internal workaround to the user and left the app with a degraded upload state.

## Fix

HEIC/HEIF photos are now treated as transcode candidates. The client converts them to JPEG, resizes them through the same canvas path as normal photos, and then uses the JPEG data URL for preview and analysis.

## Prevent Recurrence

- Do not expose internal fallback states as product UX.
- Mobile image format support must normalize to a previewable analysis format when possible.
- If an image cannot be normalized, fail clearly and ask for another JPG/PNG photo instead of claiming a degraded path is acceptable.
- Add or update unit tests for file type detection whenever mobile upload behavior changes.
