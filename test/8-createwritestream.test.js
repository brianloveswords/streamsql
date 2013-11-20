const test = require('tap').test
const useDb = require('./testdb')
const xtend = require('xtend')

const tables = ['book']

test('table.createWriteStream: simple', function (t) {
  useDb(t, tables, function (db, done) {
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

    ws.end(function () {
      const where = { id: { op: '>=', value: 100 }}
      book.get(where, function (err, found) {
        t.same(rows, found, 'should have found all the inserted rows')

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
  useDb(t, tables, function (db, done) {
    const book = makeBookDb(db)
    var ws = book.createWriteStream({ignoreDupes: true})

    ws.on('error', function () { t.fail('should have have errored') })
    ws.on('end', function () { t.end() })

    ws.write({ title: 'CivilWarLand in Bad Decline'})
    ws.end()

  })
})

function makeBookDb(db) {
  return db.table('book', {
    fields: [ 'id', 'title', 'release_date' ],
  })
}
