const test = require('tap').test
const base = require('..')
const sqliteLoad = require('./sqlite-load')

const db = base.connect({
  driver: 'sqlite3',
  database: ':memory:',
})

test('table.get', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = makeUserTable(db)

    user.row.fullname = function fullname() {
      return this.first_name + ' ' + this.last_name
    }

    const cnd = { last_name: 'Hannah' }
    const opts = { sort: 'first_name', debug: true }
    user.get(cnd, opts , function (err, row) {

      t.notOk(err, 'no errors')
      t.same(row[0].fullname(), 'Barry Hannah')

      user.getOne({last_name: 'Hannah'}, function (err, row) {
        console.log('found row', row)

        t.notOk(err, 'no errors')
        t.same(row.fullname(), 'Barry Hannah')
        t.end()
      })

    })
  })
})

test('table.get, complex where', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
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
      const expect = ['Link', 'Saunders']
      const result = rows.map(value('last_name'))
      t.same(result, expect, 'should have the right values')
      t.end()
    })
  })
})

test('table.get, complex where', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = makeUserTable(db)
    const sql = 'select last_name AS `last` from $table where first_name = ? OR first_name = ?'
    user.get([sql, ['George', 'Kelly']], function (err, rows) {
      const expect = ['Saunders', 'Link']
      const result = rows.map(value('last'))
      t.same(result, expect, 'should have the right values')
      t.end()
    })
  })
})

test('table.get, relationships', function (t) {
  sqliteLoad(db, ['band-sqlite'], function () {
    const band = db.table('band', {
      fields: [ 'name', 'founded', 'disbanded' ],
      relationships: {
        albums: {
          type: 'hasMany',
          local: 'id',
          foreign: { table: 'album', key: 'bandId' }
        },
        members: {
          type: 'hasMany',
          local: 'id',
          foreign: { table: 'member', key: 'bandId' }
        }
      }
    })

    const album = db.table('album', {
      fields: [ 'bandId', 'name', 'released' ]
    })

    const member = db.table('member', {
      fields: [ 'bandId', 'firstName', 'lastName' ]
    })

    band.getOne({}, {
      debug: true,
      relationships: true
    }, function (err, row) {
      console.dir(row)
      t.notOk(err, 'no error')
      t.same(row.albums.length, 2, 'two albums')
      t.same(row.members.length, 4, 'four members')
      t.end()
    })
  })
})

test('table.get, nested relationships', function (t) {
  sqliteLoad(db, ['user-sqlite', 'book-sqlite', 'review-sqlite'], function () {
    const user = makeUserTable(db)
    const book = makeBookTable(db)
    const review = makeReviewTable(db)

    review.getOne({ id: 1 }, {
      debug: true,
      relationships: true,
      relationshipsDepth: -1
    }, function (err, review) {
      t.notOk(err, 'no errors')
      t.same(review.test(), 'This is a review', 'review is model instance')
      t.ok(review.book, 'review book returned')
      t.same(review.book.test(), 'This is a book', 'book is model instance')
      t.ok(review.book.author, 'review book author returned')
      t.same(review.book.author.test(), 'This is a user', 'author is model instance')
      t.ok(review.book.author.books, 'review book author publications returned')
      t.same(review.book.author.books[0].test(), 'This is a book', 'review book author publications are model instances')
      t.end()
    })
  })
})

test('table.get, many-to-many relationships', function (t) {
  sqliteLoad(db, ['via-sqlite'], function () {
    const primary = makeViaPrimaryTable(db);
    const secondary = makeViaSecondaryTable(db);
    const via = makeViaThroughTable(db);

    primary.get({}, {
      debug: true,
      relationships: true
    }, function (err, rows) {
      t.same(rows.length, 3)
      t.same(rows[0].things.length, 3)

      secondary.get({id: 2}, {
        debug: true,
        relationships: true
      }, function (err, rows) {
        t.same(rows.length, 1)
        t.same(rows[0].things.length, 2)

        t.end()
      });
    })
  })
})

function value(name) { return function (obj) { return obj[name] } }

function makeUserTable(db) {
  return db.table('user', {
    fields: ['id', 'first_name', 'last_name', 'age'],
    methods: {
      test: function testUserMethods () {
        return 'This is a user'
      }
    },
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
    methods: {
      test: function testBookMethods () {
        return 'This is a book'
      }
    },
    relationships: {
      author: {
        type: 'hasOne',
        local: 'author_id',
        foreign: { table: 'user', key: 'id' },
      },
      reviews: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'review', key: 'book_id' },
        optional: true,
      },
    },
  })
}

function makeReviewTable(db) {
  return db.table('review', {
    fields: ['id', 'book_id', 'link'],
    methods: {
      test: function testReviewMethods () {
        return 'This is a review'
      }
    },
    relationships: {
      book: {
        type: 'hasOne',
        local: 'book_id',
        foreign: { table: 'book', key: 'id' },
      }
    }
  })
}

function makeViaPrimaryTable(db) {
  return db.table('viaPrimary', {
    fields: ['id', 'label'],
    relationships: {
      things: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'viaSecondary', key: 'id' },
        via: { table: 'viaThrough', local: 'primary_id', foreign: 'secondary_id' }
      }
    }
  })
}

function makeViaSecondaryTable(db) {
  return db.table('viaSecondary', {
    fields: ['id', 'label'],
    relationships: {
      things: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'viaPrimary', key: 'id' },
        via: { table: 'viaThrough', local: 'secondary_id', foreign: 'primary_id' }
      }
    }
  })
}

function makeViaThroughTable(db) {
  return db.table('viaThrough', {
    fields: ['primary_id', 'secondary_id']
  })
}
