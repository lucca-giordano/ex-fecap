create database escritorio;
use escritorio;

create table dept(   
  deptno     integer,   
  dname      varchar(14),   
  loc        varchar(13),   
  constraint pk_dept primary key (deptno)   
);

create table emp(   
  empno    integer,   
  ename    varchar(10),   
  job      varchar(9),   
  mgr      integer,   
  hiredate date,   
  sal      float,   
  comm     integer,   
  deptno   integer,   
  constraint pk_emp primary key (empno),   
  constraint fk_deptno foreign key (deptno) references dept (deptno)   
);

#Inserindo Dados tabela Dept
insert into DEPT (DEPTNO, DNAME, LOC) 
values(10, 'ACCOUNTING', 'NEW YORK');
insert into dept   
values(20, 'RESEARCH', 'DALLAS');
insert into dept   
values(30, 'SALES', 'CHICAGO');
insert into dept  
values(40, 'OPERATIONS', 'BOSTON');

#Inserindo Dados Tabela Emp
insert into emp   
values(   
 7839, 'KING', 'PRESIDENT', null,   
 '1981-11-17',   
 5000, null, 10   
);
insert into emp  
values(  
 7698, 'BLAKE', 'MANAGER', 7839,  
 '1981-1-5',  
 2850, null, 30  
);

insert into emp  
values(  
 7782, 'CLARK', 'MANAGER', 7839,  
 '1981-6-9',  
 2450, null, 10  
);
insert into emp  
values(  
 7566, 'JONES', 'MANAGER', 7839,  
 '1981-4-2',  
 2975, null, 20  
);
insert into emp  
values(  
 7788, 'SCOTT', 'ANALYST', 7566,  
 '1987-7-13',  
 3000, null, 20  
);
insert into emp  
values(  
 7902, 'FORD', 'ANALYST', 7566,  
 '1981-12-3',  
 3000, null, 20  
);
insert into emp  
values(  
 7369, 'SMITH', 'CLERK', 7902,  
 '1980-12-17',  
 800, null, 20  
);
insert into emp  
values(  
 7499, 'ALLEN', 'SALESMAN', 7698,  
 '1981-2-22',  
 1600, 300, 30  
);
insert into emp  
values(  
 7521, 'WARD', 'SALESMAN', 7698,  
'1981-2-22',  
 1250, 500, 30  
);
insert into emp  
values(  
 7654, 'MARTIN', 'SALESMAN', 7698,  
 '1981-9-28',  
 1250, 1400, 30  
);

insert into emp  
values(  
 7844, 'TURNER', 'SALESMAN', 7698,  
 '1981-9-8',  
 1500, 0, 30  
);
insert into emp  
values(  
 7876, 'ADAMS', 'CLERK', 7788,  
 '1987-07-13',  
 1100, null, 20  
);
insert into emp  
values(  
 7900, 'JAMES', 'CLERK', 7698,  
 '1981-12-3',  
 950, null, 30  
);
insert into emp  
values(  
 7934, 'MILLER', 'CLERK', 7782,  
 '1982-1-23',  
 1300, null, 10  
);


-- Trazer todos os campos da tabela dept --
SELECT * from dept;

-- Trazer todos os campos da tabela emp --
SELECT * from emp;

-- Selecionar as colunas ename, job da tabela emp
SELECT ename,job from emp;

-- Trazer valores distintos --
SELECT distinct job from emp;

-- Selecionar todos os empregados que tem o salario maior que 300 --
SELECT * from emp WHERE sal > 300;

-- Selecionar todos os empregados que tem o salario menor que 1000 --
SELECT * from emp WHERE sal < 1000;

-- Selecionar nas tabelas ename, job e deptno os funcionaros que tem como cargo clerk 
SELECT ename,job,deptno FROM emp WHERE jobs="clerk";

-- Selecionar nas tabelas ename, job os funcionarios que tem como o salario menor ou igual a comissão
SELECT ename, job, sal, comm FROM emp WHERE sak <= comm;

-- Selecionar os funcionarios que o salario esta entre 2500 e 3000
SELECT ename FROM emp WHERE sal BETWEEN 2500 and 3000;

-- EXERCICIOS -- 

-- 1. Exibir os dados do funcionário James --
SELECT empno, ename, hiredate FROM emp WHERE ename = "James";

-- 2. Selecionar o nome, cargo e salário dos empregados, com exceção dos que tenham "job" = "manager" --
SELECT ename, job, sal FROM emp WHERE job != "manager";

-- 3. Listar todos os empregados com salários entre 1000 e 2000 --

SELECT ename, sal FROM emp WHERE sal BETWEEN 1000 and 2000;

-- 4. Listar o nome, salário e departamento dos empregados com o cargo de "PRESIDENT e "ANALYST" --
SELECT ename, sal, deptno FROM emp WHERE job="president" or job="analyst";
SELECT ename, sal, deptno FROM emp WHERE job in ("president", "analyst");

-- 5. Listar o nome, salario e departamento dos empregados com os cargos diferentes de "PRESIDENT" e "ANALYST" --
SELECT ename, job, sal, deptno FROM emp WHERE job NOT IN ("president", "analyst"); 

-- 6. Selecionar todos os empregados que ganhem mais de 2500 e trabalhem no depto 30 --
SELECT ename, job, sal, deptno FROM emp WHERE deptno=30 and sal >=2500;

-- 7. Selecionar todos os empregados que ganhem menos de 1000 e mais de 3000 --
SELECT ename, job, sal FROM emp WHERE sal <= 1000 or sal >= 3000;

-- 8. Exibir todos os funcionários que ganhem mais de 2500 e traballhem nos departamentos 10 ou 30 --
SELECT ename, job, sal, deptno FROM emp WHERE sal >= 2500 and (deptno = 10 or deptno = 30);

-- 9. Exibir tudo da empresa --
SELECT * FROM emp;

-- FIM DOS EXERCICIOS --

-- OPERADOR LIKE --

SELECT * FROM emp WHERE ename LIKE 'K%';
-- retorna "KING"

SELECT * FROM emp WHERE ename LIKE '__L%';
-- retorna "ALLEN" e "MILLER"

-- o operador LIKE faz uma busca dentro de uma string. O "_" corta uma letra e o "%" 
-- ignora todas a frente ou atrás da letra, depende da posição que você coloca-lo.