Teammate's UI components from the AI Studio commit 3e4da7e (header, sidebar). Kept for design reference.
They import src/context/OfflinePaymentContext, which does not exist in this repo, and read a fake wallet shape (trustScore, batteryLevel).
Excluded from the build (tsconfig) until they are rewired to src/lib/device.ts (useDevice) and the real /api. Do not re-add the Express mock server.
