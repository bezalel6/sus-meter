const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = !isProduction;
  const browser = env?.browser || 'chrome'; // Default to chrome
  const distDir = `dist-${browser}`;

  return {
    entry: {
      background: './src/background/index.ts',
      'content-lichess': './src/content/lichess.ts',
      'content-chess-com': './src/content/chess-com.ts',
      popup: './src/popup/index.ts',
    },
    output: {
      path: path.resolve(__dirname, distDir),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: [/node_modules/, /__tests__/, /\.test\.ts$/, /\.spec\.ts$/],
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@background': path.resolve(__dirname, 'src/background'),
        '@content': path.resolve(__dirname, 'src/content'),
        '@popup': path.resolve(__dirname, 'src/popup'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@types': path.resolve(__dirname, 'src/types'),
      },
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: `public/manifest-${browser}.json`,
            to: 'manifest.json',
          },
          {
            from: 'public/icons',
            to: 'icons',
          },
        ],
      }),
      new HtmlWebpackPlugin({
        template: './public/popup.html',
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      ...(isProduction
        ? [
            new MiniCssExtractPlugin({
              filename: '[name].css',
            }),
          ]
        : []),
    ],
    devtool: isDevelopment ? 'inline-source-map' : false,
    optimization: {
      minimize: isProduction,
    },
    watchOptions: {
      ignored: /node_modules/,
    },
  };
};