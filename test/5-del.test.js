const test = require('tap').test
const useDb = require('./testdb')

test('table.del', function (t) {
  useDb(t, ['user'], function (db, done) {
    const user = db.table('user', {
      fields: ['first_name', 'last_name'],
    })

    user.del({haunted: null, last_name: 'Hannah'}, {
      debug: true
    }, function (err, result) {
      t.notOk(err, 'no errors')
      t.same(result.affectedRows, 1, 'should affect one row')

      user.get({last_name: 'Hannah'}, function (err, rows) {
        t.same(rows, [], 'should have no results')
        t.end()
      })
    })
  })
})

test('table.del, OR query', function (t) {
  useDb(t, ['user'], function (db, done) {
    const user = db.table('user', {
      fields: ['first_name', 'last_name'],
    })

    user.del([{age: {value: 65, operation: '>='}}, {first_name: 'George'}], {
      debug: true
    }, function (err, result) {
      t.notOk(err, 'No errors')
      t.same(result.affectedRows, 2, 'should affect two rows')

      t.end()
    })
  })
})
