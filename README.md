# streamsql [![Build Status](https://secure.travis-ci.org/brianloveswords/streamsql.png?branch=master)](http://travis-ci.org/brianloveswords/streamsql)


A streaming MySQL library heavily inspired by <a href="https://github.com/rvagg/levelup">`levelup`</a>


## Install

```bash
$ npm install streamsql
```


## API

### Base
* <a href="#connect"><code>base.<b>connect()</b></code></a>

### DB
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

```js
const streamSql = require('stream-sql')
const db = streamSql.connect({
  user: process.env['DB_USER'],
  password: process.env['DB_PASSWORD'],
  database: 'music'
})
```

Returns a `db` object

--------------------------------------------------------

<a name='registerTable'></a>
### db.table(localName, definition)

Registers a table against the internal table cache. Note, this **does not** create the table in the database (nor does it run any SQL at all).

`localName` is the name the table will be registered under. You can use this later with `connection.table()` to get a handle for the table.

#### <code>definition</code>

* `primaryKey`: the primary key for the table. Defaults to `id`
* `tableName`: the name of the table in the actual database. Defaults to `localName`
* `fields`: an array representing all the fields this table has. Example: `['id', 'first_name', 'last_name', 'created_at']`
* `methods`: methods to add to a row object as it gets emitted from the database. `this` in the function context will be a reference to the row. Example:

```js
db.table('friendship', {
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
<a name='put'></a>
### table.put(row, callback)

Inserts or updates a single row.

An insert will always be attempted first. If the insert fails with an duplicate entry error (as tested by the specific driver implementation) **and** the row contains the table's primaryKey, an update will be attempted

`callback` will receive two arguments: `err`, `result`. Result should have three properties, `row`, `sql`, and `insertId`. If the result of a `put()` is an update, the result will have `affectedRows` instead of `insertId`.

--------------------------------------------------------
<a name='get'></a>
### table.get(conditions, options, callback)
### table.getOne(conditions, options, callback)

Gets some (or one) row from the table.

<a name="conditions"></a>
#### <code>conditions</code>

`conditions` can be in any number of forms depending on how you're trying to select things

Simple, uses `=` for comparison:
```js
albums.get({ artist: 'Hookworms' }, function(err, rows){ ... })
```

**Explicit comparison operation**:
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

**Implicit `in` comparison**:
```js
albums.get({
  artist: [
    'My Bloody Valentine',
    'Slowdive',
    'Ride'
  ]
}, function(err, rows){ ... })
```

**Multiple conditions on a single column**:
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

Currently all of the conditions are inclusive – the where statement is joined with `AND` – so the row must match all of the parameters to be included. However, there's a final option that lets you do whatever you want:

**Raw sql**
Note, you can use `$table` as a placeholder for the current table so you don't have to hardcode it.
```js
albums.get([
  'SELECT `release_date` AS `date` FROM $table WHERE `title` = ? AND `artist`= ?',
  ['Siamese Dream', 'The Smashing Pumpkins']
], function(err, rows){ ... })
```

<a name="get-options"></a>
#### <code>options</code>

* `include`: Rows to select from the database. Any rows not in this list will not included. Note, the primary key will **always** be included.
* `exclude`: Rows in this list will not be selected from the database. If both `include` and `exclude` are defined, `include` is always preferred
* `sort`: Can be one of three forms:
  - Implicit ascending, single column: <code>{sort: 'artist'}</code>
  - Implicit ascending, multiple rows: <code>{sort: ['artist', 'release_date']</code>
  - Explicit: <code>{sort: { artist: 'desc', release_date: 'asc'}}</code>
* `limit` and `page`: How many rows and which page of results to get. Example: `{limit: 25, page: 3}`
* `debug`: When set to true, the generated SQL statement will be printed to `stderr`.

--------------------------------------------------------
<a name='del'></a>
### table.del(conditions, options, callback)

Deletes rows from the database.

**Be careful** – you can truncate an entire table with this command.

```js
garbage.del({}, function(err){
  // garbage is now empty.
})
```

* `conditions`: <a href="#conditions">see above</a>
* `options`:
  * `limit`: maximum number of rows to delete

--------------------------------------------------------
<a name='readStream'></a>
### table.createReadStream(conditions, options)

Create a ReadStream for the table.

* `conditions`: <a href="#conditions">see above</a>
* `options`: <a href="#get-options">see above</a>

#### <code>pause()</code> and <code>resume()</code>

`pause()` and `resume()` will attempt to operate on the underlying connection when applicable, [such as with the mysql driver](https://github.com/felixge/node-mysql#streaming-query-rows))

#### Events

* `data`: Receives one argument, `row`.
* `error`: If there is an error, it will be emitted here.
* `end`: When the stream is complete.

#### <code>options.relationships</code>

You can define relationships on the data coming out of the stream. `hasOne` relationships will translate to `JOIN`s at the SQL layer, and `hasMany` will perform an additional query.

`options.relationships` is an object, keyed by property. The property name will be used when attaching the foreign rows to the main row.

* `type`: Either `"hasOne"` or `"hasMany"`.
* `foreign`: Definition for the right side of the join.
  * `table`: The name of the table. This should be the name you used to register the table with `db.table`.
  * `as`: How to alias the table when performing the join. This is mostly useful when doing a self-join on a table so you don't get an ambiguity error. Defaults to the name of the table.
  * `key`: The foreign key to use.
* `local`: Definition for the left side of the join. If you're just joining on a key normally found in the current table, this can be a string. If you are doing a cascading join (i.e., joining against a field acquired from a different join) you can use an object here:
  * `table`: The name of the table. **Important** if you aliased the table with `as`, use the alias here.
  * `key`: Key to use
* `optional`: Whether or not the relationship is optional (INNER vs LEFT join). Defaults to `false`.

The results of the fulfilled relationship will be attached to the main row by their key in the `relationships` object. All foreign items will have their methods as you defined them when setting up the table with `db.table`.

##### Example

**user** table

id | handle | name | location
---|--------|------|---------
1 | brianloveswords | brian | brooklyn
2 | mozilla | mozilla | the internet

**food** table

id | user_id | text
---|----------|-----
1 | 1 | tacos
2 | 1 | pizza
3 | 2 | burritos
4 | 2 | fries
5 | 1 | salmon

```js
user.createReadStream({}, {
  relationships: {
    food: {
      type: 'hasMany',
      foreign: { table: 'food',
      from: 'id',
      pivot: 'id',
    }
  }
})
```

This would emit two rows:
```js
// row 1
{ id: 1,
  handle: 'brianloveswords',
  name: 'brian',
  location: 'brooklyn',
  food: [
    { id: 1, user_id 1,  text: 'tacos' },
    { id: 2, user_id 1,  text: 'pizza' },
    { id: 5, user_id 1,  text: 'salmon' },
  ]
}

// row 2
{ id: 2,
  handle: 'mozilla',
  name: 'mozilla',
  location: 'the internet',
  food: [
    { id: 3, user_id 2, text: 'burittos'},
    { id: 4, user_id 2, text: 'fries' }
  ]
}
```

--------------------------------------------------------
<a name='readStream'></a>
### table.createKeyStream(conditions)

Emits a `data` event for each row with just the primary key of that row.

[See above](#conditions) for definition of `conditions`

--------------------------------------------------------
<a name='writeStream'></a>
### table.createWriteStream(options)

Creates a WriteStream to the table.

The `write()` method on the stream takes row data. When a row is successfully written, a `meta` event is emitted and passed a `meta` object containing `row`, `sql` and `insertId`

An internal buffer is not kept, so all calls to `write()`s will return `false` to signal a ReadStream to `pause()`. Once a row has been succesfully stored, a `drain` event will be emitted.


If `options.ignoreDupes`, any duplicate key errors will be ignored instead of emitting an `error` event. Ignored rows will be emitted as `dupe` events.

#### Example

```js
const ws = band.createWriteStream()

ws.on('error', function (err) {
  console.log('Oh my!', err)
})

ws.on('close', function () {
  console.log('Done!')
})

ws.write({ name: 'Brian', instrument: 'bass', food: 'burritos' })
ws.write({ name: 'Jeremy', instrument: 'drums', food: 'cheese' })
ws.write({ name: 'Travis', instrument: 'tambourine', food: 'tofu' })
ws.end()
```
