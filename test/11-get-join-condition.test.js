const test = require('tap').test
const useDb = require('./testdb')


test('table.get, relationships', function (t) {
  useDb(t, ['user', 'book'], function (db, done) {
    const user = makeUserTable(db)
    const book = makeBookTable(db)

    user.getOne({ id: 3 }, {
      debug: true,
      relationships: true
    }, function (err, author) {
      console.log("AUTH", author)
      t.notOk(err, 'no errors')
      t.equal(author.last_name, 'Link', 'We\'ve found Link')

      book.get({ author_id: 3, release_date: '2000' }, {
        debug: true,
      }, function (err, books) {
        t.notOk(err, 'no errors')
        t.equal(author.books.length, books.length, 'All of author\'s year 2000 books found')
        t.end()
      })
    })
  })
})


test('table.get, many-to-many relationships', function (t) {
  useDb(t, ['via'], function (db, done) {
    const primary = makeViaPrimaryTable(db);
    const secondary = makeViaSecondaryTable(db);
    const via = makeViaThroughTable(db);

    primary.get({}, {
      debug: true,
      relationships: true
    }, function (err, rows) {
      t.same(rows.length, 3)
      t.same(rows[0].things.length, 1)
      t.same(rows[1].things.length, 0)
      t.same(rows[2].things.length, 1)

      secondary.get({id: 1}, {
        debug: true,
        relationships: true
      }, function (err, rows) {
        t.same(rows.length, 1)
        t.same(rows[0].things.length, 1)

        t.end()
      });
    })
  })
})


function value(name) { return function (obj) { return obj[name] } }

function makeUserTable(db) {
  return db.table('user', {
    fields: ['first_name', 'last_name', 'age'],
    methods: {
      test: function testUserMethods () {
        return 'This is a user'
      }
    },
    relationships: {
      books: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'book', key: 'author_id', conditions: { release_date: '2000' } },
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

/*
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
*/

function makeViaPrimaryTable(db) {
  return db.table('viaPrimary', {
    fields: ['id', 'label'],
    relationships: {
      things: {
        type: 'hasMany',
        local: 'id',
        foreign: { table: 'viaSecondary', key: 'id', conditions: { label:'as' } },
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
        foreign: { table: 'viaPrimary', key: 'id', conditions: { label:'the' } },
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
