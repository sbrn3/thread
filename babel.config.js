module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin MUST be listed last (Reanimated v3+ requirement).
    plugins: ['react-native-reanimated/plugin'],
  };
};
