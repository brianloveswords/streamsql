DROP TABLE IF EXISTS `book`;
CREATE TABLE `book` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `author_id` INTEGER,
  `title` VARCHAR(255) NOT NULL UNIQUE,
  `release_date` VARCHAR(255) NOT NULL
);

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (1, 'CivilWarLand in Bad Decline', '1996-01');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (1, 'Pastoralia', '2000-06');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (1,'The Very Persistent Gappers of Frip','2000-08');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (1,'The Brief and Frightening Reign of Phil','2005-09');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (1,'In Persuasion Nation','2006-04');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (1,'Tenth of December','2013-01');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (2,'Airships','1978');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (2,'Captain Maximus','1985');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (2,'Bats out of Hell','1993');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (2,'High Lonesome','1996');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (2,'Long, Last, Happy: New and Selected Stories','2010');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (3,'Stranger Things Happen','2000');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (3,'4 Stories','2000');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (3,'Magic for Beginners','2005');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (3,'La jeune détective et autres histoires étranges','2008');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (3,'Pretty Monsters','2008');

INSERT INTO `book` (`author_id`, `title`, `release_date`)
       VALUES (3,'Origin Stories','2012');
