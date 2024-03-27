import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        // Criando um objeto da classe Analista
        System.out.println("**Dados do Analista:**");
        System.out.print("Nome: ");
        String nomeAnalista = scanner.nextLine();
        System.out.print("Matrícula: ");
        String matriculaAnalista = scanner.nextLine();
        System.out.print("Quantidade de projetos: ");
        int numProjetos = scanner.nextInt();
        float[] valorPorProjetoAnalista = new float[numProjetos];
        for (int i = 0; i < numProjetos; i++) {
            System.out.print("Valor do projeto " + (i + 1) + ": ");
            valorPorProjetoAnalista[i] = scanner.nextFloat();
        }
        Analista analista = new Analista(nomeAnalista, matriculaAnalista, valorPorProjetoAnalista);

        // Criando um objeto da classe Programador
        System.out.println("\n**Dados do Programador:**");
        System.out.print("Nome: ");
        String nomeProgramador = scanner.nextLine();
        System.out.print("Matrícula: ");
        String matriculaProgramador = scanner.nextLine();
        System.out.print("Valor da hora: ");
        float valorHoraProgramador = scanner.nextFloat();
        System.out.print("Quantidade de horas trabalhadas: ");
        float qtdeHorasProgramador = scanner.nextFloat();
        Programador programador = new Programador(nomeProgramador, matriculaProgramador, valorHoraProgramador, qtdeHorasProgramador);

        // Exibindo os dados dos funcionários
        System.out.println("\n**Salário do Analista " + analista.getNome() + " (" + analista.getMatricula() + "): R$" + analista.calculaSalario());
        System.out.println("**Salário do Programador " + programador.getNome() + " (" + programador.getMatricula() + "): R$" + programador.calculaSalario());
    }
}