SystemJS.config({
  paths: {
    "npm:": "jspm_packages/npm/"
  },
  browserConfig: {
    "baseURL": "/"
  }
});

SystemJS.config({
  packageConfigPaths: [
    "npm:@*/*.json",
    "npm:*.json"
  ],
  map: {
    "unthenify": "npm:unthenify@1.0.2"
  },
  packages: {
    "npm:unthenify@1.0.2": {
      "map": {
        "util-arity": "npm:util-arity@1.0.2"
      }
    }
  }
});
