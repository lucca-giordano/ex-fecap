
import java.util.Scanner;

/*15.A série de Fibonacci é formada pela seqüência 1,1,2,3,5,8,13,21,34,55,...
Faça um programa capaz de gerar a série até o n−ésimo termo.
*/

public class Exercicio3 {
    public static void main(String[] args) {
        // Instanciando o Scanner
        Scanner ler = new Scanner(System.in);

        // Declarando as variáveis
        double n, a = 0, b = 1, c;

        // Perguntando o número
        System.out.println("Digite o número: ");
        n = ler.nextInt();

        // Gerando a série de Fibonacci
        for(int i = 0; i < n; i++) {
            System.out.println(a);
            c = a + b;
            a = b;
            b = c;
        }
    }
}
