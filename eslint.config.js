// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // La app no usa React Compiler (experiments.reactCompiler = false), así que
    // los patrones con refs durante el render son intencionales.
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      // expo-notifications reexporta sus enums con `export *` y el plugin no lo detecta
      'import/namespace': 'off',
    },
  },
]);
