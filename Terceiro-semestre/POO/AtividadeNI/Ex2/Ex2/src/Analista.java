

public class Analista extends Empregado{

    private float[] valorPorProjeto;


    public Analista(String nome, String matricula, float[] valorPorProjeto) {
        super(nome, matricula);
        this.valorPorProjeto = valorPorProjeto;
    }

    public float calculaSalario() {
        float salario = 0;
        for (float valor : valorPorProjeto) {
            salario += valor;
        }
        return salario;
    }


}
