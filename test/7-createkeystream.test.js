const test = require('tap').test
const useDb = require('./testdb')
const concat = require('concat-stream')

const tables = ['book']

test('table.createKeyStream: no condition', function (t) {
  useDb(t, tables, function (db, done) {
    const book = makeBookDb(db)
    book.createKeyStream().pipe(concat(function (ids) {
      book.get(function (err, rows) {
        t.same(rows.map(field('id')), ids, 'should have same ids')
        t.end()
      })
    }))
  })
})

test('table.createKeyStream: with condition', function (t) {
  useDb(t, tables, function (db, done) {
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
