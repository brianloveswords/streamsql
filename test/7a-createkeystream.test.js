const test = require('tap').test
const sqliteLoad = require('./sqlite-load')
const xtend = require('xtend')
const base = require('..')
const concat = require('concat-stream')

const db = base.connect({
  driver: 'sqlite3',
  database: ':memory:',
})

const tables = ['book-sqlite']

test('table.createKeyStream: no condition', function (t) {
  sqliteLoad(db, tables, function () {
    const book = makeBookDb(db)
    book.createKeyStream({}, {
      orderBy: 'id',
      debug: true
    }).pipe(concat(function (ids) {
      book.get(function (err, rows) {
        t.same(rows.map(field('id')), ids, 'should have same ids')
        t.end()
      })
    }))
  })
})

test('table.createKeyStream: with condition', function (t) {
  sqliteLoad(db, tables, function () {
    const book = makeBookDb(db)
    const condition = { release_date: [2000, 1996] }
    book.createKeyStream(condition, {debug: true})
      .pipe(concat(function (ids) {
        book.get(condition, function (err, rows) {
          var badCondition = rows.some(function (row) {
            const releaseYear = new Date(row.release_date).getUTCFullYear()
            return releaseYear != 2000 && releaseYear != 1996
          })
          t.notOk(badCondition, 'condition should have worked')
          t.same(rows.map(field('id')), ids, 'should have same ids')
          t.end()
        })
      }))
  })
})

function field(key) {
  return function (obj) {
    return obj[key]
  }
}

function makeBookDb(db) {
  return db.table('book', {
    fields: [ 'id', 'title', 'release_date' ],
  })
}
