public class Programador {

    private float valorHora;
    private float qtdeHoras;

    public Programador(String nome, String matricula, float valorHora, float qtdeHoras) {
        super(nome, matricula);
        this.valorHora = valorHora;
        this.qtdeHoras = qtdeHoras;
    }

    public float calculaSalario() {
        return valorHora * qtdeHoras;
    }

}
