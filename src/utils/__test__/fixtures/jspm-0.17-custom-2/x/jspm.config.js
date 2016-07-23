SystemJS.config({
  paths: {
    "npm:": "cust_packages/npm/"
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
