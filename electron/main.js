// ES Module bridge for electron/main.cjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('./main.cjs');
