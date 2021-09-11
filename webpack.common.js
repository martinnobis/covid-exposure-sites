const path = require('path');

module.exports = {
    // The entry point file described above
    entry: './src/js/app.js',
    // The location of the build folder described above
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
};
