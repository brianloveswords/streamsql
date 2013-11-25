DROP TABLE IF EXISTS `band`;
CREATE TABLE `band` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `founded` DATE NOT NULL,
  `disbanded` DATE
);

DROP TABLE IF EXISTS `album`;
CREATE TABLE `album` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `bandId` INTEGER,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `released` DATE NOT NULL
);

DROP TABLE IF EXISTS `member`;
CREATE TABLE `member` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `bandId` INTEGER,
  `firstName` VARCHAR(255),
  `lastName` VARCHAR(255)
);


INSERT INTO `band` (`id`, `name`, `founded`, `disbanded`)
VALUES (1, 'Slint', '1986', '1992');

INSERT INTO `album` (`bandId`, `name`, `released`)
VALUES (1, 'Tweez', '1989');

INSERT INTO `album` (`bandId`, `name`, `released`)
VALUES (1, 'Spiderland', '1991');

INSERT INTO `member` (`bandId`, `firstName`, `lastName`)
VALUES (1, 'Brian', 'McMahon');

INSERT INTO `member` (`bandId`, `firstName`, `lastName`)
VALUES (1, 'David', 'Pajo');

INSERT INTO `member` (`bandId`, `firstName`, `lastName`)
VALUES (1, 'Todd', 'Brashear');

INSERT INTO `member` (`bandId`, `firstName`, `lastName`)
VALUES (1, 'Britt', 'Walford') ;
