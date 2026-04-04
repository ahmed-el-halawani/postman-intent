const path = require('path');
const fs = require('fs');

module.exports = {
  packagerConfig: {
    asar: { unpack: '**/adbkit/**' },
    extraResource: ['../apk'],
  },
  hooks: {
    // adbkit is external in Vite config but @electron-forge/plugin-vite
    // doesn't include node_modules in the package. This hook copies adbkit
    // and all its transitive dependencies into the build directory before
    // asar creation, then the asar unpack config extracts them so
    // require('adbkit') works at runtime.
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const rootModules = path.join(__dirname, 'node_modules');
      const destModules = path.join(buildPath, 'node_modules');

      // Collect adbkit + all its transitive dependencies
      const toCopy = new Set();
      function collectDeps(pkgName) {
        if (toCopy.has(pkgName)) return;
        toCopy.add(pkgName);
        const pkgJson = path.join(rootModules, pkgName, 'package.json');
        if (!fs.existsSync(pkgJson)) return;
        try {
          const deps = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).dependencies || {};
          for (const dep of Object.keys(deps)) collectDeps(dep);
        } catch {}
      }
      collectDeps('adbkit');

      for (const mod of toCopy) {
        const src = path.join(rootModules, mod);
        const dest = path.join(destModules, mod);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true });
        }
      }
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main/main.ts',
            config: 'vite.main.config.ts',
            target: 'main',
          },
          {
            entry: 'src/main/preload.ts',
            config: 'vite.preload.config.ts',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.ts',
          },
        ],
      },
    },
  ],
};
