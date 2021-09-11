// Node uses two core modules for managing module dependencies:

// The major difference between require and import, is that require will
// automatically scan node_modules to find modules, but import, which comes from
// ES6, won't.

// require -> CommonJS
// import -> ES6


// CSS
import 'bootstrap/dist/css/bootstrap.min.css';
require('../css/style.css');

// Javascript
require('./index.js');
