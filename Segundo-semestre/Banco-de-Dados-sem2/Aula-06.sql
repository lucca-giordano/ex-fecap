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

-- -- -- -- EXERCÍCIOS -- -- -- --

-- 1. Selecioar de forma ordenada o conteúdo da tabela dept de acordo com o conteúdo da coluna dname em ordem crescente
SELECT * FROM dept ORDER BY dname;

-- 2. Selecioar de forma ordenada o conteúdo da tabela dept de acordo com o conteúdo da coluna dname em ordem *decrescente*
SELECT * FROM dept ORDER BY dname DESC;

-- 3. Selecionar de forma ordenada os campos ename e job da tabela emp de acordo com o conteúdo da coluna job e ename em ordem crescente
SELECT ename, job FROM emp ORDER BY job, ename;