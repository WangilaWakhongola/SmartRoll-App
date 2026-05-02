module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@':           './src',
            '@app':        './app',
            '@components': './src/components',
            '@contexts':   './src/contexts',
            '@hooks':      './src/hooks',
            '@services':   './src/services',
            '@utils':      './src/utils',
            '@types':      './src/types',
            '@constants':  './constants',
          },
        },
      ],
    ],
  };
};
