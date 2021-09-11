const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

// All this css stuff is to create a separate file that bundles all the css
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = merge(common, {
    mode: 'production',
    plugins: [new MiniCssExtractPlugin()],
    module: {
      rules: [
        {
          test: /.s?css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
        },
      ],
    },
    optimization: {
      minimize: true  ,
      minimizer: [
        // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
        '...',
        new CssMinimizerPlugin(),
      ],
    },
  }
);
