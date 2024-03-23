public class Carro extends Veiculo{

    private int numeroPortas;

    public Carro(String modelo, int anoFabricacao, double preco, int numeroPortas) {
        super(modelo, anoFabricacao, preco);
        this.numeroPortas = numeroPortas;
    }


}
