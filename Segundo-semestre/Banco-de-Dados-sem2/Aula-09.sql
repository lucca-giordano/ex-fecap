CREATE database aula08;
USE aula08;

CREATE TABLE locais(
id INT auto_increment primary key,
nome VARCHAR(50),
coordenadas INT
);

INSERT INTO locais (nome, coordenadas) VALUES 
("Ponto A", POINT(40.7, -74.8)),
("Ponto B", POINT(27.8, 80.9));

SELECT locais.nome AS local_origem, l.nome AS local_destino, ST_DISTANCE(locais.coordenadas, l.coordenadas) AS distancia FROM locais JOIN locais AS l ON locais.id <> I.id;