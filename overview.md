# Decision points

## Package Discovery
* Distribution channels
  * [x] npm
  * [ ] bower
  * [ ] github
  * [ ] jspm
  * [ ] nuget
  * [ ] apm
  * [ ] atmosphere (meteor)
* Package name alias (deferred)
  * Alias for different distribution channels vs name in registry
* Versioning
  * Semver ranges in the registry and do intersection
  * Some distribution channels are not following semver
* Server side API
  * e.g.: `/versions/:source/:package/:version/lates`

## Typings Delivery
* Delivery System
  * npm or typings/registry
* `typings.json`
* `.typingsrc`?

## Typings content
* Content Addressable Hash
