use escritorio;
CREATE VIEW visao01 as select empno, ename, job FROM emp;
SELECT * FROM visao01;

CREATE VIEW visao02 AS SELECT empno, ename nome, job cargo FROM emp;

SELECT * FROM visao02;

CREATE VIEW empdep_visao AS SELECT emp.ename, emp.deptno, dept.dname FROM dept, emp WHERE dept.deptno = emp.deptno;
SELECT * FROM empdep_visao;