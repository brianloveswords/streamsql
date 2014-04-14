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
      fields: ['id', 'first_name', 'last_name', 'age']
    })

    const row = {
      first_name: 'Brian',
      last_name: 'Brennan',
      age: 28,
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
        return user.put({first_name: 'Sean', last_name: 'Smith'})
      })

      .then(function(meta) {
        t.ok(meta.insertId, 'should have inserted row')
        return user.put({
          first_name: 'Sean',
          last_name: 'Smith',
          age: 33,
        }, {uniqueKey: ['first_name', 'last_name']})
      })

      .then(function(meta) {
        t.same(meta.affectedRows, 1, 'should have updated one row')
        t.end()
      })

  })
})
