public abstract class Empregado {

    protected String nome;
    protected String matricula;

    public Empregado(String nome, String matricula) {
        this.nome = nome;
        this.matricula = matricula;
    }

    public String getNome() {
        return nome;
    }

    public String getMatricula() {
        return matricula;
    }

    public abstract float calculaSalario();

}
