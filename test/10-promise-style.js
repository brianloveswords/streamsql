const test = require('tap').test
const useDb = require('./testdb')

test('table.get', function (t) {
  useDb(t, ['user'], function (db) {
    const user = makeUserTable(db)
    const getUsers = user.getAll()

    getUsers.then(function (users) {
      t.same(users.length, 3)
      t.end()
    }).error(errHandler)
      .catch(errHandler)

    function errHandler() {
      t.fail('should have had an error of any kind')
    }
  })
})

test('table.put', function (t) {
  useDb(t, ['user'], function (db) {
    const user = makeUserTable(db)
    const putUser = user.put({
      first_name: 'Haruki',
      last_name: 'Murakami',
    })

    putUser.then(function (result) {
      const author = result.row
      t.same(author, {
        first_name: 'Haruki',
        last_name: 'Murakami'
      })
      author.id = result.insertId
      author.age = 65
      return user.put(author)
    }).then(function(result){
      const author = result.row
      t.same(author.age, 65)
      t.end()
    }).error(errHandler)
      .catch(errHandler)

    function errHandler() {
      t.fail('should have had an error of any kind')
    }
  })
})

test('table.del', function (t) {
  useDb(t, ['user'], function (db) {
    const user = makeUserTable(db)
    const userData = {
      first_name: 'Test',
      last_name: 'Author',
    }
    user.put(userData).then(function(result){
      t.same(result.row, userData)
      return user.del({first_name: 'Test'})
    }).then(function(result){
      t.same(result.affectedRows, 1, 'should have deleted one row')
      return user.del({first_name: 'Test'})
    }).then(function(result){
      t.same(result.affectedRows, 0, 'should not affect anything')
      t.end()
    })
  })
})

function makeUserTable(db) {
  return db.table('user', {
    fields: ['first_name', 'last_name', 'age'],
    relationships: {
      books: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'book', key: 'author_id' },
        optional: true,
      }
    },
  })
}
