# mysql-stream-db

## API

### Base
* <a href="#table"><code>base.<b>connect()</b></code></a>

### DB
* <a href="#registerTable"><code>db.<b>registerTable()</b></code></a>
* <a href="#table"><code>db.<b>table()</b></code></a>

### Table

* <a href="#put"><code>table.<b>put</b>()</code></a>
* <a href="#get"><code>table.<b>get</b>()</code></a>
* <a href="#del"><code>table.<b>del</b>()</code></a>
* <a href="#readStream"><code>table.<b>createReadStream</b>()</code></a>
* <a href="#keyStream"><code>table.<b>createKeyStream</b>()</code></a>
* <a href="#writeStream"><code>table.<b>createWriteStream</b>()</code></a>

--------------------------------------------------------

<a name='connect'></a>
### base.connect(options)

This is shorthand for [establishing a mysql connection](https://github.com/felixge/node-mysql#establishing-connections) and connecting to it. See the linked page for the connection options.

Returns a `db` object

--------------------------------------------------------

<a name='registerTable'></a>
### db.registerTable(localName, options)

Registers a table against the internal table cache. Note, this **does not** create the table in the database (nor does it run any SQL at all).

`localName` is the name the table will be registered under. You can use this later with `connection.table()` to get a handle for the table.

#### <code>options</code>

* `primaryKey`: the primary key for the table. Defaults to `id`
* `tableName`: the name of the table in the actual database. Defaults to `localName`
* `fields`: an array representing all the fields this table has. Example: `['id', 'first_name', 'last_name', 'created_at']`
* `methods`: methods to add to a row object as it gets emitted from the database. `this` in the function context will be a reference to the row. Example:

```js
db.registerTable('friendship', {
  fields: [ 'id', 'screen_name', 'friend' ],
  methods: {
    hifive: function hifive() {
      return this.screen_name + ' deserves a hifive!'
    }
  }
})
```

Returns a `table` object.

--------------------------------------------------------
<a name="table"></a>
### db.table(localName)

Return a previously registered table. If the table is not in the internal cache, `db.table` will throw an error.

Returns a `table` object.

--------------------------------------------------------

<a name='get'></a>
### table.get(conditions, options, callback)

Gets some a single row from the table.

<a name="conditions"></a>
#### <code>conditions</code>

`conditions` can be in one of two forms: simple or explicit

Simple:
```js
albums.get({
  artist: 'Hookworms',
  album: 'Teen Dream'
}, function(err, rows){ ... })
```

Explicit:
```js
albums.get({
  artist: {
    value: 'Hookworms',
    operation: '=',
  },
  release_year: {
    operation: '<=',
    value: 2012
  }
}, function(err, rows){ ... })
```

You can also mix and match the types and use arrays:

Mixed
```js
albums.get({
  artist: 'David Bowie',
  release_year: [{
    operation: '>=',
    value: 1976
  }, {
    operation: '<='
    value: 1978
  }]
}, function(err, rows){ ... })
```

(NOTE: arrays not yet implemented)

Currently all of the conditions are inclusive – the where statement is joined with `AND` – so the row must match all of the parameters to be included.

#### <code>options</code>

* `sort`: TODO: implement
* `limit`: TODO: implement
* `page`: TODO: implement
