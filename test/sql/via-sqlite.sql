DROP TABLE IF EXISTS `viaPrimary`;
CREATE TABLE `viaPrimary` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `label` VARCHAR(255) NOT NULL
);

DROP TABLE IF EXISTS `viaSecondary`;
CREATE TABLE `viaSecondary` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `label` VARCHAR(255) NOT NULL
);

DROP TABLE IF EXISTS `viaThrough`;
CREATE TABLE `viaThrough` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT,
  `primary_id` INTEGER,
  `secondary_id` INTEGER,
  UNIQUE (`primary_id`, `secondary_id`)
);

INSERT INTO `viaPrimary` (`id`, `label`) VALUES
  (1, 'the'),
  (2, 'and'),
  (3, 'to');

INSERT INTO `viaSecondary` (`id`, `label`) VALUES
  (1, 'as'),
  (2, 'had'),
  (3, 'with');

INSERT INTO `viaThrough` (`id`, `primary_id`, `secondary_id`) VALUES
  (1, 1, 1),
  (2, 1, 2),
  (3, 1, 3),
  (4, 2, 2),
  (5, 2, 3),
  (6, 3, 1);
