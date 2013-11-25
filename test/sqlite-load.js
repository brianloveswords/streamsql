function read(name) {
  const fs = require('fs')
  const path = require('path')
  return fs.readFileSync(path.join(__dirname, 'sql', name + '.sql')).toString('utf8')
}

function load(db, tables, callback) {
  db.connection.serialize(function () {
    tables.forEach(function (table) {
      const sql = read(table)
      const statements = sql.split(';')
      statements.forEach(function (statement) {
        db.query(statement, function (err) {
          if (err) console.error(err)
        })
      })
    })
    callback()
  })
}

module.exports = load
