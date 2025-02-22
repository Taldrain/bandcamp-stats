import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: [
    'src/main.album.js',
    // 'src/main.collection.js',
    'src/options.js',
    'src/options.html',
  ],
  bundle: true,
  outdir: 'dist',
  loader: {
    '.html': 'copy',
  },
})
