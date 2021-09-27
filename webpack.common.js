// All this css stuff is to create a separate file that bundles all the css
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

const HtmlWebpackPlugin = require("html-webpack-plugin");

// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const pages = ["index", "vic", "nsw"];

module.exports = {
    // The entry point file described above
    entry: pages.reduce((config, page) => {
        config[page] = `./src/js/${page}.js`;
        return config;
    }, {}),
    // plugins: [new BundleAnalyzerPlugin()].concat(
    plugins: [].concat(
        pages.map(
            page =>
            new HtmlWebpackPlugin({
                inject: true,
                template: `./src/${page}.html`,
                filename: `${page}.html`,
                chunks: [page],
            })
        )),
    module: {
        rules: [{
            test: /\.css$/,
            use: ["style-loader", "css-loader"],
        }, ],
    },
};
