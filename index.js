const Stream = require('stream')
const util = require('util')
const map = require('map-stream')
const xtend = require('xtend')
const create = require('./lib/create')
const fmt = util.format.bind(util)

const dbProto = {}
const tableProto = {}

dbProto.close = function close(callback) {
  return this.driver.close(this.connection, callback)
}

dbProto.table = function table(name, definition) {
  if (definition)
    return this.registerTable.apply(this, arguments)

  const tableDefinition = this.tables[name]
  if (!tableDefinition)
    throw new Error(fmt('No table registered with the name `%s`', name))
  return tableDefinition
}

dbProto.registerTable = function registerTable(name, def) {
  const fields = def.fields || []
  const primaryKey = def.primaryKey || 'id'

  if (fields.indexOf(primaryKey) === -1)
    fields.unshift(primaryKey)

  if (!def.hasOwnProperty('constructor')) {
    def.constructor = function createRow (data) {
      return create(table.row, data)
    }
  }

  const table = create(tableProto, {
    table: def.tableName || name,
    primaryKey: primaryKey,
    fields: fields,
    row: def.methods || {},
    constructor: def.constructor,
    relationships: def.relationships || {},
    db: this,
  })

  this.tables[name] = table
  return table
}

tableProto.put = function put(row, callback) {
  const table = this.table
  const primaryKey = this.primaryKey
  const driver = this.db.driver
  const insertSql = driver.insertSql(table, row)
  const tryUpdate = primaryKey in row
  const meta = { row: row, sql: null, insertId: null }
  const query = this.db.query(insertSql, function (err, result) {
    if (err) {
      if (tryUpdate && driver.putShouldUpdate(err))
        return this.update(row, callback)
      return callback(err)
    }

    meta.sql = insertSql
    meta.insertId = result.insertId

    return callback(null, meta)
  }.bind(this))
}

tableProto.update = function update(row, callback) {
  const table = this.table
  const primaryKey = this.primaryKey
  const driver = this.db.driver
  const updateSql = driver.updateSql(table, row, primaryKey)
  const query = this.db.query(updateSql, handleResult.bind(this))
  const meta = {
    row: row,
    sql: updateSql,
    affectedRows: null
  }

  function handleResult(err, result) {
    if (err) { return callback(err) }
    meta.affectedRows = result.affectedRows
    return callback(null, meta)
  }
}

tableProto.get = function get(cnd, opts, callback) {
  if (typeof opts == 'function') {
    callback = opts
    opts = {}
  }

  if (typeof cnd == 'function') {
    callback = cnd
    cnd = {}
    opts = {}
  }

  const RowClass = this.constructor
  const driver = this.db.driver

  const table = this.table
  const tableCache = this.db.tables
  var relationships = opts.relationships || {}
  var error = {}

  if (typeof relationships == 'boolean' &&
      relationships === true) {
    relationships = this.relationships
  }

  const selectSql = driver.selectSql({
    db: this.db,
    table: table,
    tables: tableCache,
    relationships: relationships,
    fields: this.fields,
    conditions: cnd,
    limit: opts.limit,
    include: opts.include,
    exclude: opts.exclude,
    page: opts.page,
    order: opts.order || opts.orderBy,
  })

  if (typeof selectSql == 'object' && selectSql.name == 'RangeError') {
    error = selectSql
    return setImmediate(callback.bind(null, error))
  }

  this.db.query(selectSql, opts.single ? singleRow : manyRows)

  const hydrOpts = {
    table: table,
    relationships: relationships,
    tableCache: tableCache,
  }

  function singleRow(err, rows) {
    if (err) return callback(err)
    if (!rows.length) return callback()

    const singleton = rows[0]

    if (!singleton)
      return callback()

    driver.hydrateRow(singleton, hydrOpts, function (err, result) {
      if (err) return callback(err)

      return callback(null, new RowClass(result))
    })
  }


  function manyRows(err, rows) {
    if (err) return callback(err)

    driver.hydrateRows(rows, hydrOpts, function (err, rows) {
      if (err) return callback(err)
      return callback(null, rows.map(function (row) {
        return new RowClass(row)
      }))
    })
  }

  if (opts.debug)
    console.error(selectSql)
}

tableProto.getOne = function getOne(cnd, opts, callback) {
  if (typeof opts == 'function') {
    callback = opts
    opts = {}
  }
  const singularOpts = { limit: 1, single: true }
  return this.get(cnd, xtend(opts, singularOpts), callback)
}

tableProto.del = function del(cnd, opts, callback) {
  if (typeof opts == 'function') {
    callback = opts
    opts = null
  }
  opts = opts || {}
  const query = this.db.query
  const driver = this.db.driver
  const table = this.table
  const deleteSql = driver.deleteSql({
    table: table,
    conditions: cnd,
    limit: opts.limit
  })

  if (opts.debug)
    console.error(deleteSql)

  return query(deleteSql, callback)
}

tableProto.createReadStream = function createReadStream(conditions, opts) {
  opts = opts || {}
  const conn = this.db.connection
  const driver = this.db.driver
  const fields = this.fields
  const table = this.table

  var relationships = opts.relationships || {}

  if (typeof relationships == 'boolean' &&
      relationships === true) {
    relationships = this.relationships
  }

  const selectSql = driver.selectSql({
    db: this.db,
    table: table,
    tables: this.db.tables,
    fields: fields,
    conditions: conditions,
    limit: opts.limit,
    page: opts.page,
    relationships: relationships,
    include: opts.include,
    exclude: opts.exclude,
    order: opts.order || opts.orderBy,
  })

  const tableCache = this.db.tables

  const queryStream = this.db.queryStream(selectSql, {
    rowPrototype: this.row,
    relationships: relationships,
    tableCache: this.db.tables,
    table: table,
  })

  if (opts.debug)
    console.error(selectSql)

  return queryStream
}

tableProto.createKeyStream = function createKeyStream(conditions, opts) {
  const primaryKey = this.primaryKey

  opts = xtend(opts, {
    orderBy: opts.orderBy || primaryKey,
    include: [ primaryKey ]
  })

  const keyStream = this.createReadStream(conditions, opts)
    .pipe(map(function (row, next) {
      return next(null, row[primaryKey])
    }))

  return keyStream
}

tableProto.createWriteStream = function createWriteStream(opts) {
  opts = opts || {}

  const ignoreDupes = opts.ignoreDupes
  const conn = this.db.connection
  const table = this.table
  const stream = new Stream()
  const emit = stream.emit.bind(stream)

  const put = this.put.bind(this)

  var waiting = 0
  var ending = false

  function done() {
    ['finish', 'close', 'end'].forEach(emit)
  }

  function drain() {
    waiting -= 1
    emit('drain')
    if (ending && waiting <= 0)
      return done()
  }

  stream.readable = true
  stream.writable = true

  stream.write = function write(row, callback) {
    waiting += 1

    put(row, function handleResult(err, meta) {
      if (err) {
        if (ignoreDupes) {
          emit('dupe', row)
          return drain()
        }

        if (callback) { callback(err) }
        emit('error', err, meta)
        return drain()
      }

      emit('meta', meta)
      emit('data', row)

      if (callback && typeof callback == 'function')
        callback(null, meta)

      return drain()
    })

    return false;
  }

  stream.end = function end(row, callback) {
    stream.readable = false

    if (typeof row == 'function') {
      callback = row
      row = null
    }

    if (callback)
      stream.on('end', callback)

    if (row) {
      stream.write(row)
      return stream.end()
    }

    if (waiting > 0)
      ending = true

    else
      done()
  }

  return stream
}

const base = module.exports = {
  connect: function connect(options, callback) {
    const driver = getDriver(options.driver)
    const connection = driver.connect(options, callback)
    return create(dbProto, {
      connection: connection,
      query: driver.getQueryFn(connection),
      queryStream: driver.getStreamFn(connection),
      tables: {},
      driver: driver,
    })
  }
}

function getDriver(name) {
  const drivers = require('./lib/drivers')
  const prototype = require('./lib/drivers/prototype')
  const implementation = drivers[name || 'mysql']()
  return create(prototype, implementation)
}
