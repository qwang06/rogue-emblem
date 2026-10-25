// Features that are built but switched off for now. Flip one to true to
// turn it on; code that depends on a flag reads it from here.
export interface FeatureFlags {
  // The music (src/audio/songs.ts) and its volume setting. Sound effects
  // play either way.
  music: boolean;
}

export const FEATURE_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  music: false,
});
