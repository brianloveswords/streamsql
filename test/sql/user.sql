DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `first_name` VARCHAR(255) NOT NULL UNIQUE,
  `last_name` VARCHAR(255),
  `born` DATETIME
);

INSERT INTO `user` SET
  `id` = 1,
  `first_name` = 'George',
  `last_name` = 'Saunders',
  `born` = '1958-12-2';

INSERT INTO `user` SET
  `id` = 2,
  `first_name` = 'Barry',
  `last_name` = 'Hannah',
  `born` = '1942-04-23';

INSERT INTO `user` SET
  `id` = 3,
  `first_name` = 'Kelly',
  `last_name` = 'Link',
  `born` = '1969-07-19';
