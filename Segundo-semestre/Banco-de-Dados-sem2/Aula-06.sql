use escritorio;

-- Cláusula ORDER BY --
-- Esse construtor faz com que a seleção traga os elementos em ordem
-- Não faz nenhuma alteração na tabela, é apenas para visualização
SELECT * FROM emp ORDER BY job;
SELECT * FROM emp;

-- Função MAX --
-- A função MAX analísa um conjunto de valores e retorna o maior valor entre eles
SELECT MAX(sal) FROM emp;

-- Função MIN --
-- É o oposto do MAX, retorna o menor valor do conjunto
SELECT MIN(sal) FROM emp;

-- Função SUM --
-- Soma os valores de uma colúna e retorna um valor único
SELECT SUM(sal) FROM emp;
SELECT SUM(sal) FROM emp WHERE job="MANAGER";

-- Função AVG --
-- Calcula e retorna a média dos valores selecionados
SELECT AVG(sal) FROM emp;

-- Função COUNT --
-- A função COUNT retorna o total de linhas selecionadas
SELECT COUNT(empno) FROM emp WHERE job="SALESMAN";

-- Cláusula GROUP BY
-- Ao utiliza-lo, dividimos os registros que serão agregados em grupos de valores
SELECT job, MAX(sal) FROM emp GROUP BY job;	
SELECT deptno, MIN(sal), MAX(sal), SUM(sal) FROM emp GROUP BY deptno;

-- Função HAVING
-- É usado para filtrar os resultados que serão submetidos a agregação
SELECT job, MAX(sal) FROM emp GROUP BY job HAVING MAX(sal) > 1000;

-- Função ALIAS (AS)
-- Da um apelido a uma ou mais categorias selecionadas
SELECT job, MAX(sal) AS maximo_salario FROM emp GROUP BY job HAVING MAX(sal) > 1000;

-- Função UPPER --
-- Converte todos os caracteres para maiscula
SELECT UPPER(job), MAX(sal) FROM emp GROUP BY job;

-- Função LOWER --
-- Converte todos os caracteres para minuscula
SELECT LOWER(job), MAX(sal) FROM emp GROUP BY job;

-- Função LENGTH --
-- Retorna a quantidade de caracteres
SELECT ename, LENGTH(ename) FROM emp;

-- Operador CONCAT --
-- Concatena as colunas
SELECT CONCAT(ename, ' trabalha como ', job) AS concatenando FROM emp;

-- Trabalhando com DARA/HORA --
-- É possível armazenar a hora atual em uma coluna de uma tabela:

CREATE TABLE minha_tabela(
id INT AUTO_INCREMENT PRIMARY KEY,
data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS data_formatada;

SELECT TIMESTAMPDIFF(MINUTE, '2023-09-20 10:00:00', NOW()) AS diferenca_minuto;

SELECT * FROM minha_tabela WHERE DATE(data_registro) = CURDATE();

SELECT DATE_FORMAT("2017-06-15","%d %M %Y");

-- -- -- -- EXERCÍCIOS -- -- -- --

-- 1. Selecioar de forma ordenada o conteúdo da tabela dept de acordo com o conteúdo da coluna dname em ordem crescente
SELECT * FROM dept ORDER BY dname;

-- 2. Selecioar de forma ordenada o conteúdo da tabela dept de acordo com o conteúdo da coluna dname em ordem *decrescente*
SELECT * FROM dept ORDER BY dname DESC;

-- 3. Selecionar de forma ordenada os campos ename e job da tabela emp de acordo com o conteúdo da coluna job e ename em ordem crescente
SELECT ename, job FROM emp ORDER BY job, ename;

-- 4. Selecionar todos os empregados com salário entre 1000 e 1500
SELECT * FROM emp WHERE sal >= 1000 and sal <= 1500;

-- 5. Apresente todos os nomes de empregados que tenham TH ou LL
SELECT ename FROM emp WHERE ename LIKE '%TH%' OR ename LIKE '%LL%';

-- 6. Selecionar os emprgados que tenham o mesmo cargo do empregado 7369 e que tenham um salário maior que o empregado 7876
SELECT ename, job FROM emp WHERE job=(SELECT job FROM emp WHERE empno=7369) AND sal > (SELECT sal FROM emp WHERE empno=7876);