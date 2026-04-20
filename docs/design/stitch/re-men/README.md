# RE:MEN Stitch Export

## Source

- Project title: `RE:MEN`
- Project ID: `15855318137314659396`
- Exported on: `2026-04-20`
- Tool path: `@_davideast/stitch-mcp`

## Exported Screens

| Screen | ID | Image | Code |
|---|---|---|---|
| Add to Closet | `1f46ab21482240b4a6471725be7d7ca7` | `Add-to-Closet/screen.png` | `Add-to-Closet/screen.html` |
| Home Screen | `c8d43704a5f44e6cb15bf553a18bd463` | `Home-Screen/screen.png` | `Home-Screen/screen.html` |
| Style Analysis | `df3f025a6c5742bb8948e2af09efa977` | `Style-Analysis/screen.png` | `Style-Analysis/screen.html` |
| 옷장 등록 | `0673f110c926411f99f8c1f19bde0360` | `옷장-등록/screen.png` | `옷장-등록/screen.html` |
| 홈 화면 | `100001f60a8f4e59a4b1e0ef58198ae3` | `홈-화면/screen.png` | `홈-화면/screen.html` |
| 스타일 분석 결과 | `ce0a7529079f4d3493d6f910fa16b61e` | `스타일-분석-결과/screen.png` | `스타일-분석-결과/screen.html` |

## Design System

- Requested ID: `asset-stub-assets-21ecec1aecdf41888e0e858dadf21546-1776652141349`
- Stitch `get_screen` result: not a screen resource.
- Resolved design system: `Sartorial Slate`
- Files:
  - `Design-System/design.md`
  - `Design-System/tokens.json`
  - `Design-System/metadata.json`

## Integration Notes

- Use `Sartorial Slate` as the visual target, not as a direct code copy.
- Prioritize Manrope-like editorial headings, slate/navy surfaces, muted emerald actions, and tonal layering.
- Avoid importing Stitch HTML directly into app routes because the current app has auth, credits, storage, and onboarding state that must remain intact.
- Use these artifacts as reference for refactoring existing RE:MEN components and CSS tokens.
