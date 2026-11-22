
-- criar tabela tb_perfil
create table tb_perfil(
	per_id int not null primary key auto_increment,
    per_nome varchar(255)
);

-- inserir dados na tabela tb_perfil
insert into tb_perfil (per_nome) values ('Administrador');
insert into tb_perfil (per_nome) values ('Aluno');

-- criar a tabela tb_usuario
create table tb_usuario (
	usu_id int not null primary key auto_increment,
    usu_nome varchar(255),
    usu_email varchar(255),
    usu_senha varchar(255),
    usu_ativo varchar(1),
    per_id int,
    constraint fk_usuario_perfil foreign key 
    (per_id) references 
    tb_perfil(per_id)
);

-- inserir dados na tabela tb_usuario
insert into tb_usuario (usu_nome, usu_email, 
usu_senha, usu_ativo, per_id) values ('Fulvio', 
'teste@teste.com', '12345', 'S', 1);

-- criar as tabelas relacionadas ao ecommerce
CREATE TABLE `tb_marca` (
  `mar_id` int NOT NULL AUTO_INCREMENT,
  `mar_nome` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`mar_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `tb_categoria` (
  `cat_id` int NOT NULL AUTO_INCREMENT,
  `cat_nome` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`cat_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `tb_produto` (
  `prd_id` int NOT NULL AUTO_INCREMENT,
  `prd_cod` varchar(50) DEFAULT NULL,
  `prd_nome` varchar(255) DEFAULT NULL,
  `prd_quantidade` int DEFAULT NULL,
  `cat_id` int DEFAULT NULL,
  `mar_id` int DEFAULT NULL,
  `prd_imagem` varchar(255) DEFAULT NULL,
  `prd_preco` decimal(6,2) DEFAULT NULL,
  PRIMARY KEY (`prd_id`),
  KEY `fk_produto_marca` (`mar_id`),
  KEY `fk_produto_categoria` (`cat_id`),
  CONSTRAINT `fk_produto_categoria` FOREIGN KEY (`cat_id`) REFERENCES `tb_categoria` (`cat_id`),
  CONSTRAINT `fk_produto_marca` FOREIGN KEY (`mar_id`) REFERENCES `tb_marca` (`mar_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

insert into tb_marca (mar_nome) values ('Jequiti');
insert into tb_marca (mar_nome) values ('Boticário');
insert into tb_marca (mar_nome) values ('Natura');


insert into tb_categoria (cat_nome) values ('Blush');
insert into tb_categoria (cat_nome) values ('Batom');
insert into tb_categoria (cat_nome) values ('Maquiagem');
insert into tb_categoria (cat_nome) values ('Perfume');


create table tb_pedido (
	ped_id int not null primary key auto_increment
);

create table tb_pedidoitens (
	pit_id int not null primary key auto_increment,
    ped_id int,
    prd_id int,
    pit_quantidade int,
    
    constraint fk_pedido_item foreign key (ped_id) references tb_pedido(ped_id),
    constraint fk_pedido_produto foreign key (prd_id) references tb_produto(prd_id)
);





