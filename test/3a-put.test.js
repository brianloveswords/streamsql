const test = require('tap').test
const base = require('..')
const sqliteLoad = require('./sqlite-load')

const db = base.connect({
  driver: 'sqlite3',
  database: ':memory:',
})

test('sql loading', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = db.table('user', {
      fields: ['id', 'first_name', 'last_name']
    })

    const row = {
      first_name: 'Brian',
      last_name: 'Brennan'
    }

    user.put(row)
      .then(function(meta) {
        t.ok(meta.insertId, 'should have an insertId')
        t.same(row, meta.row, 'should have correct row')
        return user.put({
          id: meta.insertId,
          first_name: 'Sean'
        })
      })

      .then(function(meta) {
        t.same(meta.affectedRows, 1, 'should have affected one row')
        return user.put({first_name: 'Brian', last_name: 'Smith'})
      })

      .then(function(meta) {
        t.ok(meta.insertId, 'should have inserted row')
        return user.put({first_name: 'Brian', last_name: 'Williams'}, {uniqueKey: 'first_name'})
      })

      .then(function(meta) {
        t.same(meta.affectedRows, 1, 'should have updated')
        t.end()
      })

  })
})
