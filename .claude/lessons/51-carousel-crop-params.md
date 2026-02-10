# Lesson: Fix Carousel Crop Parameter Swap

## What We Built

Fixed a bug where carousel images disappeared after being cropped/positioned in the admin settings modal.

## Why This Approach

The `react-easy-crop` library's `onCropComplete` callback has the signature:
```
onCropComplete(croppedArea: Area, croppedAreaPixels: Area)
```
- First argument: **percentage-based** area (0-100 range)
- Second argument: **pixel-based** area

The parameter names in `ImageCropEditor.tsx` were swapped:
```typescript
// BEFORE (bug): names are backwards, code uses pixel values
(_croppedAreaPixels: Area, croppedAreaPercentages: Area) => { ... }

// AFTER (fix): names match actual positional args
(croppedAreaPercentages: Area, _croppedAreaPixels: Area) => { ... }
```

This caused pixel values (e.g. `width: 3000`) to be stored where percentages (e.g. `width: 50`) were expected. When `cropToStyle()` computed `100 / (3000/100)`, the image rendered at ~3% size — effectively invisible inside the `overflow-hidden` container.

## Key Concepts

- **Positional arguments matter more than names**: JavaScript destructures by position, not name. Misleading parameter names can mask bugs that pass type checking.
- **The bug was subtle**: Both `Area` types have the same shape `{ x, y, width, height }`, so TypeScript couldn't catch the swap. Only the value ranges differ (percentages vs pixels).
- **Cascade effect**: The incorrect crop data was stored in KV (Redis), so it persisted and affected the shop page carousel rendering too.

## Testing Strategy

Added a regression test that:
1. Mocks `react-easy-crop` to capture the `onCropComplete` callback
2. Calls it with known percentage and pixel values
3. Asserts that `onChange` receives the percentage values (first arg), not pixel values (second arg)

This test directly validates the parameter order and will catch any future regression.

## What You Learned

- Always verify third-party callback signatures against docs, especially when parameter types are structurally identical
- When images "disappear", check if CSS values are producing near-zero dimensions
- `vi.resetModules()` is needed before `vi.doMock()` when the module was imported by earlier tests
