# Engenharia de Software

## Métodos Ágeis

Métodos ageis são abordagens iterativas e incrementais para o desenvolvimento de software e gestão de projetos, enfatizando a colaboração, flexibilidade e entrega contínua de valor.

### Maniesto ágil

-  `individuos e interações` mais do que processos e ferramentas

- `software funcionando` mais do que documentação extensiva

- `colaboração com o cliente` mais do que negociação de contratos

- `responder a mudanças` mais do que seguir um plano

### Importancia dos métodos ágeis

- `Flexibilidade e adaptação`: métodos ágeis permitem adaptação rápida às mudanças de requisitos e condições de mercado

- `Colaboração continua`: promovem uma comunicação constante entre equipes e stakeholders

- `Entrega contínua de valor`: entregas frequentes de software funcionando

### Scrum

Scrum é um framework que organiza o `tarbalho em ciclos` chamados **sprints**, com papéis bem definidos e eventos para revisar e adaptar o progresso do projeto. 

Nessa abordagem, o time é organizado por **papéis**, e o trabalho é dividido em pequenas entregas, com foco na entrega de valor ao cliente. Esses papéis são:

- `Product Owner`: responsável por **definir o que será feito** e priorizar o backlog do produto

- `Scrum Master`: responsável por **garantir que o time siga as práticas** do Scrum e remova impedimentos

- `Time de desenvolvimento`: responsável por **desenvolver o software**

Os eventos do Scrum são:

- `Sprint planning`: reunião para **planejar o trabalho** do sprint

- `Daily Scrum`: reunião diária para **sincronizar o time**

- `Sprint Review`: reunião para **revisar e adaptar o produto**

- `Sprint Retrospective`: reunião para **melhorar o processo**

### Kanban

Kanban é um método para **gerenciar o trabalho de forma visual**, com foco na **limitação do trabalho em progresso**. Ele permite que as equipes visualizem o fluxo de trabalho e identifiquem gargalos e oportunidades de melhoria.

O Kanbam é normalmente representado por um quadro com **colunas que representam as etapas do processo** e **cartões que representam as tarefas**. As equipes movem os cartões pelo quadro conforme o progresso do trabalho.

Por exemplo, um quadro Kanban pode ter as seguintes colunas:

- `To Do`: tarefas a serem feitas

- `Doing`: tarefas em progresso

- `Done`: tarefas finalizadas

Alguns dos principios mais importantes do Kanban são:

- `Visualização do trabalho`: permite que as equipes vejam o fluxo de trabalho e identifiquem gargalos

- `Limitação do WIP (Work in progress)`: evita sobrecarga e ajuda a manter o foco

- `Gestão do fluxo`: foco na entrega contínua de valor

- `Política explícita`: definição clara de como o trabalho é realizado

- `Feedback e ajustes`: melhoria contínua baseada em dados e feedback

### Extreme Programming (XP)

Extreme Programming (XP) é uma metodologia ágil que enfatiza a **qualidade do software** e a **colaboração entre os membros da equipe**. Ela promove práticas como **programação em pares**, **testes automatizados** e **integração contínua**.

- `Desenvolvimento iterativo`: Trabalha em ciclos curtos e incrementais

- `Feedback constante`: Incentiva a obtenção de feedback regular dos stakeholders para ajustar o desenvolvimento.

- `Simplicidade no design`: Foca em criar a solução mais simples que atenda às necessidades atuais, evitando complexidade desnecessária.

- `Propriedade coletiva do código`: Todos os membros da equipe são responsáveis pelo código, promovendo a colaboração e a manutenção contínua.

- `Entrega frequente de pequenas atualizações`: O software é entregue em versões pequenas e frequentes, facilitando a adaptação às mudanças.

- `Testes frequentes`: Realiza testes contínuos para garantir que novas funcionalidades não quebrem o código existente.

- `Comunicação aberta`: Promove uma comunicação clara e frequente entre todos os membros da equipe e com os stakeholders.

## Padrões de Projeto

Padrões de projeto são soluções para problemas comuns no desenvolvimento de software, que foram identificados e documentados por especialistas na área. Eles fornecem uma abordagem testada e comprovada para resolver problemas recorrentes, promovendo a reutilização de soluções eficazes.

Dentre os principais benefícios dos padrões de projeto estão:

- `Reutilização de soluções eficazes`: Evita a necessidade de reinventar a roda ao enfrentar problemas comuns.

- `Melhoria da qualidade do software`: Promove a utilização de soluções testadas e comprovadas.

- `Facilitação da comunicação entre desenvolvedores`: Fornece uma linguagem comum para discutir e documentar soluções.

- `Promoção da manutenibilidade e escalabilidade do software`: Facilita a manutenção e evolução do software ao longo do tempo.

Os padrões de projeto são classificados em três categorias principais:

### Padrões de Criação

A padronização de criação é um padrão de projeto que lida com a criação de objetos. Ele fornece mecanismos para criar objetos de forma mais flexível e eficiente.

Ela garante que uma classe tenha apenas uma instância e fornece um ponto de acesso global para essa instância.

Exemplo: Gerenciador de configuração que deve existir apenas uma instância em todo o sistema.

Dentro dos padrões de criação, alguns dos mais comuns são:

- `Factory Method` é um padrão de projeto que define uma - interface para criar um objeto, mas permite que as subclasses decidam qual classe instanciar. Ele permite que uma classe delegue a responsabilidade de instanciar um objeto para suas subclasses.

- `Builder` é um padrão de projeto que separa a construção de um objeto complexo de sua representação, permitindo a criação de diferentes representações do mesmo objeto.

### Padrões Estruturais

Padrões estruturais são padrões de projeto que lidam com a composição de classes e objetos para formar estruturas maiores. Eles ajudam a definir como os objetos são organizados e como se comunicam entre si.

Dentro dos padrões estruturais, alguns dos mais comuns são:

- `Adapter` é um padrão de projeto que permite que objetos com interfaces incompatíveis trabalhem juntos. Ele converte a interface de uma classe em outra interface que o cliente espera.

- `Decorator` é um padrão de projeto que permite adicionar comportamentos a objetos individuais de forma dinâmica. Ele fornece uma maneira flexível de estender a funcionalidade de um objeto sem usar subclasses.

### Padrões Comportamentais

Padrões comportamentais são padrões de projeto que lidam com a comunicação entre objetos e a responsabilidade de tarefas. Eles ajudam a definir como os objetos interagem entre si e como as responsabilidades são distribuídas entre eles.

Dentro dos padrões comportamentais, alguns dos mais comuns são:

- `Observer` é um padrão de projeto que define uma dependência um-para-muitos entre objetos, de modo que quando um objeto muda de estado, todos os seus dependentes são notificados e atualizados automaticamente.

- `Strategy` é um padrão de projeto que define uma família de algoritmos, encapsula cada um deles e os torna intercambiáveis. Ele permite que o algoritmo varie independentemente dos clientes que o utilizam.