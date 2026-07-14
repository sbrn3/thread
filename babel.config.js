module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated v4 delegates worklets to the separate react-native-worklets
    // package; its Babel plugin (not react-native-reanimated/plugin, which
    // no longer exists) must be listed last.
    plugins: ['react-native-worklets/plugin'],
  };
};
