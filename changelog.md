# 0.4.0
* From that, `sqlite3` support!
  * Separated out the ORM implementation from the driver implementation. The ORM can now rest on top of anything that supports a common interface.
* Much better relationship support: multiple `hasMany` relationships are working, multiple `hasOne` relationships no longer rely on a specific driver implementation.
  * Changed relationship definition format to be friendlier and not require some weird stuff that was necessary before when trying to pull off `hasMany` with JOINs.

* `include` and `exclude` options on `get`/`getOne` and `createReadStream`
