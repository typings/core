SystemJS.config({
  paths: {
    "npm:": "cust_packages/npm/"
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
    "domready": "npm:domready@1.0.8"
  },
  packages: {}
});
