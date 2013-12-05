const test = require('tap').test
const useDb = require('./testdb')

test('table.get', function (t) {
  useDb(t, ['user'], function (db, done) {
    const user = makeUserTable(db)

    user.row.fullname = function fullname() {
      return this.first_name + ' ' + this.last_name
    }

    user.get({ last_name: 'Hannah' }, {
      sort: 'first_name',
      debug: true
    }, function (err, row) {
      t.notOk(err, 'no errors')
      t.same(row[0].fullname(), 'Barry Hannah')

      user.getOne({last_name: 'Hannah'}, function (err, row) {
        t.notOk(err, 'no errors')
        t.same(row.fullname(), 'Barry Hannah')
        t.end()
      })

    })
  })
})

test('table.get, complex where', function (t) {
  useDb(t, ['user'], function (db, done) {
    const user = makeUserTable(db)
    user.get({
      age: [
        { value: 40, op: '>=' },
        { value: 60, op: '<=' },
      ]
    }, {
      sort: 'age',
      debug: true
    }, function (err, rows) {
      const expect = ['Saunders', 'Link']
      const result = rows.map(value('last_name'))
      t.same(result, expect, 'should have the right values')
      t.end()
    })
  })
})

test('table.get, complex where', function (t) {
  useDb(t, ['user'], function (db, done) {
    const user = makeUserTable(db)
    const sql = 'select last_name AS `last` from $table where first_name = ? OR first_name = ?'
    user.get([sql, ['George', 'Kelly']], function (err, rows) {
      console.dir(err)
      const expect = ['Saunders', 'Link']
      const result = rows.map(value('last'))
      t.same(result, expect, 'should have the right values')
      t.end()
    })
  })
})

test('table.get, relationships', function (t) {
  useDb(t, ['user', 'book'], function (db, done) {
    const user = makeUserTable(db)
    const book = makeBookTable(db)

    book.get({}, {
      debug: true,
      relationships: true
    }, function (err, allBooks) {
      t.notOk(err, 'no errors')
      t.equal(allBooks.length, 17, 'all books accounted for')

      book.get({ author_id: 1 }, {
        debug: true,
        relationships: true
      }, function (err, someBooks) {
        t.notOk(err, 'no errors')
        t.ok(someBooks.length < allBooks.length, 'query returns subset of books')
        t.equal(someBooks.length, 6, 'all requested books accounted for')
        t.end()
      })
    })
  })
})

test('table.get, relationships', function (t) {
  useDb(t, ['user', 'book'], function (db, done) {
    const user = makeUserTable(db)
    const book = makeBookTable(db)

    user.getOne({ id: 1 }, {
      debug: true,
      relationships: true
    }, function (err, author) {
      t.notOk(err, 'no errors')
      t.equal(author.last_name, 'Saunders', 'We\'ve found Mr Saunders')

      book.get({ author_id: 1 }, {
        debug: true,
      }, function (err, books) {
        t.notOk(err, 'no errors')
        t.equal(author.books.length, books.length, 'All of author\'s books found correctly')
        t.end()
      })
    })
  })
})

// https://github.com/brianloveswords/streamsql/issues/5
test('table.getOne, should not hang on empty rows', function (t) {
  useDb(t, ['empty'], function (db, done) {
    const empty = db.table('empty', ['space'])

    empty.getOne({ id: 1 }, {
      debug: true,
    }, function (err, row) {
      console.dir(row)
      t.end();
    })
  })
})


function value(name) { return function (obj) { return obj[name] } }

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

function makeBookTable(db) {
  return db.table('book', {
    fields: [ 'id', 'author_id', 'title', 'release_date' ],
    relationships: {
      author: {
        type: 'hasOne',
        local: 'author_id',
        foreign: { table: 'user', key: 'id' },
      },
    },
  })
}
