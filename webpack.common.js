// All this css stuff is to create a separate file that bundles all the css
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

const pages = ["nsw.html", "index.html"];

module.exports = {
    // The entry point file described above
    entry: { vic: './src/js/vic.js', nsw: './src/js/nsw.js' },
    plugins: [new MiniCssExtractPlugin()],
    module: {
        rules: [{
            test: /\.css$/,
            use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
        }, ],
    },
    optimization: {
        minimize: true,
        minimizer: [
            // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
            '...',
            new CssMinimizerPlugin(),
        ],
    },
};