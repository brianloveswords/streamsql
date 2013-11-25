const test = require('tap').test
const sqliteLoad = require('./sqlite-load')
const xtend = require('xtend')
const base = require('..')

const db = base.connect({
  driver: 'sqlite3',
  database: ':memory:',
})

const tables = ['book-sqlite']

test('table.createWriteStream: simple', function (t) {
  sqliteLoad(db, tables, function () {
    const book = makeBookDb(db)
    var ws = book.createWriteStream()

    var rows = [
      { id: 100, title: 'The Girl in the Flammable Skirt', release_date: '1998' },
      { id: 101, title: 'An Invisible Sign of My Own', release_date: '2001' },
      { id: 102, title: 'Willful Creatures', release_date: '2005' },
      { id: 103, title: 'The Third Elevator', release_date: '2009' },
      { id: 104, title: 'The Particular Sadness of Lemon Cake', release_date: '2010' },
      { id: 105, title: 'The Color Master', release_date: '2013' }
    ]

    rows.forEach(ws.write)

    const emittedRows = []
    ws.on('data', function (data) { emittedRows.push(data)})

    ws.end(function () {
      const where = { id: { op: '>=', value: 100 }}
      book.get(where, function (err, found) {
        t.same(rows, found, 'should have found all the inserted rows')
        t.same(emittedRows, rows, 'should have remitted rows')

        const alteredRows = rows.map(function (row) {
          row = xtend({}, row)
          row.release_date = '20xx'
          return row
        })

        ws = book.createWriteStream()
        alteredRows.forEach(ws.write)


        ws.end(function () {
          book.get(where, function (err, found) {
            t.same(alteredRows, found, 'should support db updates')
            t.end()
          })
        })
      })
    })
  })
})

test('table.createWriteStream: ignore errors', function (t) {
  sqliteLoad(db, tables, function () {
    const book = makeBookDb(db)
    const row = { title: 'CivilWarLand in Bad Decline'}
    var ws = book.createWriteStream({ignoreDupes: true})

    var foundDupe = false
    ws.on('error', function () { t.fail('should have have errored') })
    ws.on('dupe', function (row) { foundDupe = row })
    ws.on('end', function () {
      t.same(foundDupe, row, 'should have found dupe')
      t.end()
    })
    ws.write(row)
    ws.end()
  })
})

function makeBookDb(db) {
  return db.table('book', {
    fields: [ 'id', 'title', 'release_date' ],
  })
}
