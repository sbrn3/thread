// Every event and day row is stamped with the build that wrote it
// (§13.2), so a behaviour change can always be checked against a
// build change. Injected at build time; 'dev' outside CI.
export const BUILD_SHA: string = process.env.EXPO_PUBLIC_BUILD_SHA ?? 'dev';
