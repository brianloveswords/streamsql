DROP TABLE IF EXISTS `viaPrimary`;
CREATE TABLE `viaPrimary` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `label` VARCHAR(255) NOT NULL
);

DROP TABLE IF EXISTS `viaSecondary`;
CREATE TABLE `viaSecondary` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `label` VARCHAR(255) NOT NULL
);

DROP TABLE IF EXISTS `viaThrough`;
CREATE TABLE `viaThrough` (
  `primary_id` BIGINT,
  `secondary_id` BIGINT,
  UNIQUE KEY `first_second` (`primary_id`, `secondary_id`)
);

INSERT INTO `viaPrimary` (`label`) VALUES
  ('the'),
  ('and'),
  ('to');

INSERT INTO `viaSecondary` (`label`) VALUES
  ('as'),
  ('had'),
  ('with');

INSERT INTO `viaThrough` (`primary_id`, `secondary_id`) VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (2, 2),
  (2, 3),
  (3, 1);
