// Vercel serverless entry.
//
// Deliberately plain JavaScript pointing at the tsc output rather than a .ts
// file importing ../src: Vercel compiles files under api/ with its own bundler,
// whose module resolution differs from this project's NodeNext setup. Letting
// `npm run build` produce dist/ first means Vercel and the Docker image run byte
// -identical code, and any type error fails the build instead of the request.
export { default } from '../dist/serverless.js';
