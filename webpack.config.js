const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      'background/service-worker': './src/background/service-worker.js',
      'popup/popup': './src/popup/popup.js',
      'content/content-script': './src/content/content-script.js',
      'ui/pages/unlock': './src/ui/pages/unlock.js',
      'ui/pages/welcome': './src/ui/pages/welcome.js'
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public', to: 'public' },
          { from: 'src/libs', to: 'libs' }
        ]
      }),
      
      new HtmlWebpackPlugin({
        template: './src/popup/popup.html',
        filename: 'src/popup/popup.html',
        chunks: ['popup/popup']
      }),
      
      new HtmlWebpackPlugin({
        template: './src/ui/pages/unlock.html',
        filename: 'src/ui/pages/unlock.html',
        chunks: ['ui/pages/unlock']
      }),
      
      new HtmlWebpackPlugin({
        template: './src/ui/pages/welcome.html',
        filename: 'src/ui/pages/welcome.html',
        chunks: ['ui/pages/welcome']
      })
    ],
    
    resolve: {
      extensions: ['.js', '.json']
    },
    
    devtool: isProduction ? false : 'source-map'
  };
};
