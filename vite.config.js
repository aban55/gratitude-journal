// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// OPTIONAL: enable only if you want extra friction in prod bundles
// import obfuscator from 'rollup-plugin-obfuscator';

export default defineConfig({
  plugins: [
    react(),
    // OPTIONAL: uncomment to obfuscate output (heavier builds, harder debugging)
    // obfuscator({
    //   // Tweak as you prefer; defaults are already quite aggressive
    //   global: true,
    //   options: {
    //     compact: true,
    //     controlFlowFlattening: true,
    //     deadCodeInjection: true,
    //     stringArray: true,
    //     rotateStringArray: true,
    //     selfDefending: true,
    //   },
    // }),
  ],

  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@components': path.resolve(__dirname, 'src/components'),
      // add more as needed
    },
  },

  // Production-leaning defaults
  build: {
    sourcemap: false,            // no source maps in prod bundles
    target: 'es2018',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500, // quieten warnings for larger vendor chunks
    rollupOptions: {
      output: {
        // light manual chunking to split heavy libs from your app code
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          pdf: ['jspdf'],
        },
      },
    },
  },

  // strip out console/debugger in production
  esbuild: {
    drop: ['console', 'debugger'],
  },

  // Dev-only nicety (optional): hide Vite red error overlay if you prefer
  // server: {
  //   hmr: { overlay: false },
  // },
});
