CREATE DATABASE db; -- Cria um banco de dados --
USE db; -- Define em qual banco de dados os comandos serão executados --
DROP DATABASE db; -- Apaga a database designada --

ALTER DATABASE db READ ONLY = 0; -- "ALTER" altera alguma propriedade de algum objeto, no caso a DATABASE db, a propriedade é READ ONLY, e 1 é verdadeiro -- 

-- Pode-se ver uma DataBase como uma pasta que carrega arquivos, que são as tabelas. Vamos então criar algumas tabelas e popula-las --

CREATE TABLE empregados( -- Aqui é criada a tabela, se abre parenteses. --
	ID INT, -- Primeira coluna, nome da coluna é ID e o tipo de dado que ela recebe é de numeiros inteiros --
    primeiro_nome VARCHAR(50), -- Segunda coluna, nome é "primeiro_nome" e recebe uma string com até 50 caracteres --
    ultimo_nome VARCHAR(50), -- Terceira coluna, mesma coisa da anterior
    salario DECIMAL(7, 2), -- Quarta coluna, recebe um número decimal, onde 7 números inteiros e 2 depois da vírgula
    data_contratacao DATE -- Quinta coluna, recebe uma data, cujo SQL tem um tipo de dado próprio para isso.
); -- No final, se fecha parenteses e se coloca um ponto e virgula --

-- Aqui, é adicionado uma coluna depois que a tabela foi criada --
ALTER TABLE empregados ADD telefone VARCHAR(11);
-- Agora, vamos supor que no primeiro momento você digitou o valor máximo ou o tipo de dado errado de uma coluna nova, isso pode ser concertado dessa forma: --
ALTER TABLE empregados MODIFY COLUMN telefone VARCHAR(15);


-- Pronto, vamos popular essa tabela:
INSERT INTO empregados VALUES (
1, 
"João",  
"Silva", 
4500.00, 
"2013-01-02", 
11995483920, 
"joaosilva@empresa.com"); -- Pode-se perceber que a estrutura é parecida quando montamos a tabela inicialmente, cada linha corresponde a uma coluna em sua ordem. 

INSERT INTO empregados VALUES (
2, 
"Maria",  
"Joaquina", 
5600.00, 
"2014-05-25", 
11948653298, 
"mariajoaquina@empresa.com");

INSERT INTO empregados VALUES (
3, 
"Roberto",  
"Justus", 
12000.00, 
"2009-03-09", 
11975963215, 
"robertojustus@empresa.com");

INSERT INTO empregados VALUES (
4, 
"Mario",  
"Armário", 
2500.00, 
"2006-11-22", 
11956329868, 
"marioarmario@empresa.com");


-- O contrutor SELECT exibe algumas colunas dentro das tabelas, e seus valores. --
-- No exemplo abaixo, * significa tudo, ou seja, todas as colunas da tabela empregados --
SELECT * FROM empregados;

-- Aqui são algumas formas de brincar com esse construtor, selecionando colunas especificas ou usando condiçoões para realizar a busca. --
SELECT primeiro_nome, ultimo_nome FROM empregados;
SELECT * FROM empregados WHERE salario > 5500;
SELECT * FROM empregados WHERE ID >= 2;
SELECT primeiro_nome, ultimo_nome, salario FROM empregados WHERE salario > 3000;
SELECT * FROM empregados WHERE ID != 3;

