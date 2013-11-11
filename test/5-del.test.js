const test = require('tap').test
const useDb = require('./testdb')

test('table.get', function (t) {
  useDb(t, ['user', 'user-data'], function (db, done) {
    const user = db.table('user', {
      fields: ['first_name', 'last_name'],
    })

    user.del({last_name: 'Hannah'}, function (err, result) {
      t.notOk(err, 'no errors')
      t.same(result.affectedRows, 1, 'should affect one row')

      user.get({last_name: 'Hannah'}, function (err, rows) {
        t.same(rows, [], 'should have no results')
        t.end()
      })
    })
  })
})
