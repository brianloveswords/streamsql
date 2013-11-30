const test = require('tap').test
const base = require('..')
const sqliteLoad = require('./sqlite-load')

const db = base.connect({
  driver: 'sqlite3',
  database: ':memory:',
})

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

test('default generator', function (t) {
  sqliteLoad(db, ['review-sqlite'], function () {
    const review = makeReviewTable(db)

    review.getOne({ id: 1 }, {
      debug: true
    }, function (err, row) {
      t.notOk(err, 'no errors')
      t.equal(row.book_id, 1, 'review is of correct book')
      t.type(row.linkify, 'function', 'row methods picked up by default generator')
      t.end()
    })
  })
})

test('custom generator', function (t) {
  sqliteLoad(db, ['user-sqlite'], function () {
    const user = makeUserTable(db)

    user.getOne({last_name: 'Hannah'}, function (err, row) {
      t.notOk(err, 'no errors')
      t.ok(row instanceof User, 'is User')
      t.same(row.getFullName(), 'Barry Hannah')
      t.end()
    })
  });
})

test('custom generators with relationships', function (t) {
  sqliteLoad(db, ['user-sqlite', 'book-sqlite'], function() {
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
    generator: function (data) {
      return new User(data);
    }
  })
}

function makeBookTable(db) {
  return db.table('book', {
    fields: [ 'id', 'author_id', 'title', 'release_date' ],
    generator: function (data) {
      return new Book(data)
    },
    relationships: {
      author: {
        type: 'hasOne',
        local: 'author_id',
        foreign: { table: 'user', key: 'id' },
      },
    },
  })
}
