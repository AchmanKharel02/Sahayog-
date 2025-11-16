module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src/'],
          alias: {
            '@': './src/',
            '@components': './src/components/',
            '@screens': './src/screens/',
            '@navigation': './src/navigation/',
            '@store': './src/store/',
            '@hooks': './src/hooks/',
            '@services': './src/services/',
            '@utils': './src/utils/',
            '@assets': './src/assets/'
          }
        }
      ],
      'react-native-reanimated/plugin'
    ]
  };
};