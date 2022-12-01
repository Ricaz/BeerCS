var path = require('path');
const Dotenv = require('dotenv-webpack')

module.exports = {
	mode: 'development',
	entry: './src/webapp.js',
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
			}

		]
	},
	resolve: {
		alias: {
			vue: 'vue/dist/vue.js'
		}
	},
	output: {
		path: path.resolve(__dirname, 'dist/assets/js'),
		filename: 'bundle.js'
	},
	plugins: [ 
		new Dotenv()
	]
};
