SystemJS.config({
  paths: {
    "npm:": "jspm_packages/npm/",
    "github:": "jspm_packages/github/"
  },
  browserConfig: {
    "baseURL": "/"
  }
});

SystemJS.config({
  packageConfigPaths: [
    "npm:@*/*.json",
    "npm:*.json",
    "github:*/*.json"
  ],
  map: {
    "make-error": "npm:make-error@1.2.0",
    "popsicle-retry": "npm:popsicle-retry@3.2.1",
    "process": "github:jspm/nodelibs-process@0.2.0-alpha"
  },
  packages: {
    "npm:popsicle-retry@3.2.1": {
      "map": {
        "any-promise": "npm:any-promise@1.3.0",
        "xtend": "npm:xtend@4.0.1"
      }
    }
  }
});
