const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/client/js/app.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/client/index.html', to: 'index.html' },
        { from: 'src/client/css', to: 'css' },
        { from: 'src/client/img', to: 'img' },
        { from: 'src/client/audio', to: 'audio' },
      ],
    }),
  ],
};
