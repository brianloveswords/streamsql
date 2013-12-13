const test = require('tap').test
const useDb = require('./testdb')

function initObj (obj, data) {
  Object.keys(data).forEach(function(key) {
    Object.defineProperty(obj, key, {
      enumerable: true,
      value: data[key]
    })
  })
}

const User = function User (data) {
  initObj(this, data)
}

User.prototype.getFullName = function () {
  return [this.first_name, this.last_name].join(' ')
}

const Book = function Book (data) {
  initObj(this, data);
}

test('default constructor', function (t) {
  useDb(t, ['review'], function (db, done) {
    const review = makeReviewTable(db)

    review.getOne({ id: 1 }, {
      debug: true
    }, function (err, row) {
      t.notOk(err, 'no errors')
      t.equal(row.book_id, 1, 'review is of correct book')
      t.type(row.linkify, 'function', 'row methods picked up by default constructor')
      t.end()
    })
  })
})

test('custom constructor', function (t) {
  useDb(t, ['user'], function(db, done) {
    const user = makeUserTable(db)

    user.getOne({last_name: 'Hannah'}, function (err, row) {
      t.notOk(err, 'no errors')
      t.ok(row instanceof User, 'is User')
      t.same(row.getFullName(), 'Barry Hannah')
      t.end()
    })
  });
})

test('custom constructors with relationships', function (t) {
  useDb(t, ['user', 'book'], function(db, done) {
    const user = makeUserTable(db)
    const book = makeBookTable(db)

    book.get({ release_date: 2008 }, {
      sort: 'title',
      debug: true,
      relationships: true
    }, function (err, books) {
      t.notOk(err, 'no errors')
      t.ok(books.length > 1, 'should have more than one result')
      t.ok(books[0] instanceof Book, 'is Book')
      t.ok(books[0].author instanceof User, 'author is User')
      t.end()
    })
  })
})

function makeReviewTable(db) {
  return db.table('review', {
    fields: ['id', 'book_id', 'link'],
    methods: {
      linkify: function () {
        return '<a href="'+this.link+'">review</a>'
      }
    }
  })
}

function makeUserTable(db) {
  return db.table('user', {
    fields: ['first_name', 'last_name', 'age'],
    constructor: User
  })
}

function makeBookTable(db) {
  return db.table('book', {
    fields: [ 'id', 'author_id', 'title', 'release_date' ],
    constructor: Book,
    relationships: {
      author: {
        type: 'hasOne',
        local: 'author_id',
        foreign: { table: 'user', key: 'id' },
      },
    },
  })
}
